import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { SaleV1 } from "./sale.contract";
import { Prisma } from "@prisma/client";

interface Receipt { pdv: string; hash: string; resultado: unknown; cancelamento: unknown }

@Injectable()
export class SalesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async receive(pdv: string, sale: SaleV1) {
    const hash = createHash("sha256").update(JSON.stringify(sale)).digest("hex");
    return this.db.$transaction(async tx => {
      // Match product publisher lock ordering before stock incorporation.
      await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
      const receipts = await tx.$queryRaw<Receipt[]>`
        select pdv_uid::text as pdv, hash, resultado, cancelamento
        from public.nuvem_venda_recibo where pedido_uid=${sale.pedidoUid}::uuid for update`;
      if (receipts[0]) {
        if (receipts[0].pdv !== pdv || receipts[0].hash !== hash) {
          throw new ConflictException("Pedido ja recebido com outra identidade ou conteudo");
        }
        return receipts[0].resultado;
      }
      const existing = await tx.pedido.findUnique({ where: { sync_uid: sale.pedidoUid }, select: { sync_uid: true } });
      if (existing) throw new ConflictException("Pedido legado exige reconciliacao antes da migracao");
      if (!sale.turnoUid || !sale.operadorUid || sale.numeroNoTurno == null) {
        throw new ConflictException("Venda do PDV exige turno e operador");
      }
      const shift = await tx.turno_operacao.findUnique({ where: { sync_uid: sale.turnoUid },
        select: { pdv_uid: true, operador_uid: true } });
      if (!shift || shift.pdv_uid !== pdv || shift.operador_uid !== sale.operadorUid) {
        throw new ConflictException("Turno ou operador nao pertencem a esta maquina");
      }
      // Keep rascunho until all children exist: legacy triggers cannot incorporate partial items.
      await tx.pedido.create({ data: {
        sync_uid: sale.pedidoUid, numero: BigInt(sale.numero), cliente: sale.cliente,
        turno: sale.turno, data: sale.data, total_centavos: BigInt(sale.totalCentavos),
        operador_uid: sale.operadorUid, turno_uid: sale.turnoUid,
        numero_no_turno: sale.numeroNoTurno == null ? null : BigInt(sale.numeroNoTurno),
        origem: "pdv", estoque_status: "rascunho",
      } });
      await tx.item_pedido.createMany({ data: sale.itens.map(i => ({
        sync_uid: i.uid, pedido_uid: sale.pedidoUid, livro_uid: i.livroUid,
        codigo: i.codigo, titulo: i.titulo, preco_centavos: BigInt(i.precoCentavos),
        qtd: BigInt(i.quantidade), origem: "pdv",
      })) });
      await tx.pagamento_pedido.createMany({ data: sale.pagamentos.map(p => ({
        sync_uid: p.uid, pedido_uid: sale.pedidoUid, forma_uid: p.formaUid,
        valor_centavos: BigInt(p.valorCentavos), origem: "pdv",
      })) });
      if (sale.cancelado) {
        await tx.pedido.update({ where: { sync_uid: sale.pedidoUid }, data: { cancelado: true, cancelado_em: new Date() } });
      } else {
        await tx.pedido.update({ where: { sync_uid: sale.pedidoUid }, data: {
          estoque_status: "pronta", estoque_pronta_em: new Date(),
        } });
      }
      const state = await tx.pedido.findUniqueOrThrow({
        where: { sync_uid: sale.pedidoUid }, select: { estoque_status: true },
      });
      const result = { pedidoUid: sale.pedidoUid, recebido: true, estoqueStatus: state.estoque_status };
      await tx.$executeRaw`
        insert into public.nuvem_venda_recibo(pedido_uid,pdv_uid,hash,resultado)
        values(${sale.pedidoUid}::uuid,${pdv}::uuid,${hash},${JSON.stringify(result)}::jsonb)`;
      return result;
    }, { timeout: 30000 }).catch(databaseError);
  }

  async cancel(pdv: string, uid: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
      const rows = await tx.$queryRaw<Receipt[]>`
        select pdv_uid::text as pdv, hash, resultado, cancelamento
        from public.nuvem_venda_recibo where pedido_uid=${uid}::uuid for update`;
      if (!rows[0]) throw new NotFoundException("Venda ainda nao recebida");
      if (rows[0].pdv !== pdv) throw new ConflictException("Venda pertence a outro PDV");
      if (rows[0].cancelamento) return rows[0].cancelamento;
      await tx.pedido.update({ where: { sync_uid: uid }, data: {
        cancelado: true, cancelado_em: new Date(), atualizado_em: new Date(),
      } });
      const result = { pedidoUid: uid, cancelado: true };
      await tx.$executeRaw`
        update public.nuvem_venda_recibo set cancelamento=${JSON.stringify(result)}::jsonb
        where pedido_uid=${uid}::uuid`;
      return result;
    }, { timeout: 30000 });
  }
}

function databaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2003")) {
    throw new ConflictException("Identidade duplicada ou cadastro dependente ainda indisponivel");
  }
  throw error;
}
