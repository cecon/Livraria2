import { BadRequestException, ConflictException, Inject, Injectable,
  NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { adminSaleInput } from "./admin-sale-input";

function integer(value: bigint, label: string) {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

@Injectable()
export class AdminSalesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async create(value: unknown, actor: string) {
    const sale = adminSaleInput(value);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
      await tx.$executeRaw`lock table public.pedido in share row exclusive mode`;
      const shifts = await tx.$queryRaw<{ status: string; operador_uid: string | null }[]>`
        select status, operador_uid::text from public.turno_operacao
        where sync_uid=${sale.shiftUid}::uuid and excluido_em is null for update`;
      if (!shifts[0] || shifts[0].operador_uid !== actor) throw new NotFoundException("Turno nao encontrado");
      if (shifts[0].status !== "aberto") throw new ConflictException("Turno encerrado");
      if (await tx.pedido.findUnique({ where: { sync_uid: sale.pedidoUid } })) {
        throw new ConflictException("Venda ja registrada");
      }
      const books = await tx.livro.findMany({ where: { syncUid: { in: sale.items.map(i => i.bookUid) },
        excluidoEm: null, ativo: true }, select: { syncUid: true } });
      if (new Set(books.map(book => book.syncUid)).size !== new Set(sale.items.map(i => i.bookUid)).size) {
        throw new NotFoundException("Produto indisponivel");
      }
      const forms = await tx.forma_pagamento.findMany({ where: { sync_uid: {
        in: sale.payments.map(payment => payment.formUid) }, excluido_em: null, ativa: true },
        select: { sync_uid: true, chave: true } });
      if (forms.length !== sale.payments.length) throw new NotFoundException("Forma de pagamento indisponivel");
      const paid = sale.payments.reduce((sum, payment) => sum + BigInt(payment.value), 0n);
      const change = paid - sale.total;
      if (change < 0n) throw new BadRequestException("Pagamento insuficiente");
      const cash = new Set(forms.filter(form => form.chave === "dinheiro").map(form => form.sync_uid));
      const cashPaid = sale.payments.filter(payment => cash.has(payment.formUid))
        .reduce((sum, payment) => sum + BigInt(payment.value), 0n);
      if (change > cashPaid) throw new BadRequestException("Troco exige pagamento em dinheiro");
      const global = await tx.pedido.aggregate({ _max: { numero: true } });
      const perShift = await tx.pedido.aggregate({ where: { turno_uid: sale.shiftUid },
        _max: { numero_no_turno: true } });
      const number = (global._max.numero ?? 0n) + 1n;
      const shiftNumber = (perShift._max.numero_no_turno ?? 0n) + 1n;
      const now = new Date();
      await tx.pedido.create({ data: { sync_uid: sale.pedidoUid, numero: number,
        numero_no_turno: shiftNumber, turno_uid: sale.shiftUid, operador_uid: actor,
        cliente: sale.cliente, turno: now.getHours() < 13 ? "manha" : "tarde",
        data: now.toISOString().slice(0, 10), total_centavos: sale.total, cancelado: false,
        estoque_status: "rascunho", origem: "escritorio", criado_por: actor,
        atualizado_em: now, sincronizado_em: now } });
      await tx.item_pedido.createMany({ data: sale.items.map(item => ({ sync_uid: item.uid,
        pedido_uid: sale.pedidoUid, livro_uid: item.bookUid, codigo: item.codigo, titulo: item.titulo,
        preco_centavos: BigInt(item.price), qtd: BigInt(item.quantity), origem: "escritorio",
        criado_por: actor, atualizado_em: now, sincronizado_em: now })) });
      await tx.pagamento_pedido.createMany({ data: sale.payments.map(payment => ({ sync_uid: payment.uid,
        pedido_uid: sale.pedidoUid, forma_uid: payment.formUid, valor_centavos: BigInt(payment.value),
        origem: "escritorio", criado_por: actor, atualizado_em: now, sincronizado_em: now })) });
      await tx.pedido.update({ where: { sync_uid: sale.pedidoUid }, data: {
        estoque_status: "pronta", estoque_pronta_em: now } });
      const state = await tx.pedido.findUniqueOrThrow({ where: { sync_uid: sale.pedidoUid },
        select: { estoque_status: true } });
      const divergences = await tx.divergencia_estoque.count({ where: {
        pedido_uid: sale.pedidoUid, status: "aberta", excluido_em: null } });
      return { numeroNoTurno: integer(shiftNumber, "Numero do turno"),
        totalCentavos: integer(sale.total, "Total"), trocoCentavos: integer(change, "Troco"),
        divergenciasEstoque: divergences, estoqueStatus: state.estoque_status };
    }, { timeout: 30000 });
  }

  async today() {
    const date = new Date().toISOString().slice(0, 10);
    const rows = await this.db.pedido.findMany({ where: { data: date, excluido_em: null },
      orderBy: { numero_no_turno: "desc" }, select: { sync_uid: true, numero_no_turno: true,
        numero: true, cliente: true, total_centavos: true, cancelado: true } });
    return rows.map(row => ({ sync_uid: row.sync_uid,
      numeroNoTurno: row.numero_no_turno === null ? null : integer(row.numero_no_turno, "Numero do turno"),
      numero: integer(row.numero, "Numero"), cliente: row.cliente,
      totalCentavos: integer(row.total_centavos, "Total"), cancelado: row.cancelado }));
  }
}
