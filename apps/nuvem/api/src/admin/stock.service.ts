import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { adjustmentInput, countInput, divergenceStatus, StockMovementInput } from "./stock-input";

function safeInteger(value: bigint | null, label: string): number | null {
  if (value === null) return null;
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

@Injectable()
export class StockService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async balances() {
    const rows = await this.db.$queryRaw<{ livro_uid: string; saldo: bigint }[]>`
      select livro_uid::text, saldo from public.vw_saldo_livro order by livro_uid`;
    return rows.map(row => ({ livro_uid: row.livro_uid, saldo: safeInteger(row.saldo, "Saldo") }));
  }

  async movements(id: string) {
    const bookUid = uuid(id);
    const book = await this.db.livro.findFirst({ where: { syncUid: bookUid, excluidoEm: null },
      select: { syncUid: true } });
    if (!book) throw new NotFoundException("Produto indisponivel");
    const rows = await this.db.movimento_estoque.findMany({
      where: { livro_uid: bookUid, excluido_em: null },
      orderBy: [{ criado_em: "asc" }, { sync_uid: "asc" }],
      select: { sync_uid: true, tipo: true, qtd: true, custo_unit_centavos: true,
        fornecedor: true, motivo: true, referencia: true, criado_em: true },
    });
    return rows.map(row => ({ ...row, qtd: safeInteger(row.qtd, "Quantidade"),
      custo_unit_centavos: safeInteger(row.custo_unit_centavos, "Custo") }));
  }

  adjust(value: unknown, actor: string) {
    return this.persist([adjustmentInput(value)], "ajuste", actor, null).then(() => ({ registrado: true }));
  }

  count(value: unknown, actor: string) {
    const items = countInput(value);
    return this.persist(items, "contagem", actor, "inventario").then(() => ({ ajustes: items.length }));
  }

  private async persist(items: StockMovementInput[], type: "ajuste" | "contagem", actor: string,
    reference: string | null) {
    if (!items.length) return;
    try {
      await this.db.$transaction(async tx => {
        await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
        await tx.$executeRaw`lock table public.movimento_estoque in share row exclusive mode`;
        const ids = items.map(item => item.syncUid);
        const existing = await tx.movimento_estoque.findMany({ where: { sync_uid: { in: ids } },
          select: { sync_uid: true, livro_uid: true, qtd: true, tipo: true, excluido_em: true } });
        const byId = new Map(existing.map(row => [row.sync_uid, row]));
        for (const item of items) {
          const row = byId.get(item.syncUid);
          if (row && (row.livro_uid !== item.bookUid || row.qtd !== item.quantity ||
              row.tipo !== type || row.excluido_em !== null)) {
            throw new ConflictException("UUID de movimento ja utilizado");
          }
        }
        const bookIds = [...new Set(items.map(item => item.bookUid))];
        const books = await tx.livro.findMany({ where: { syncUid: { in: bookIds }, excluidoEm: null },
          select: { syncUid: true } });
        if (books.length !== bookIds.length) throw new NotFoundException("Produto indisponivel");
        const now = new Date();
        const missing = items.filter(item => !byId.has(item.syncUid));
        if (missing.length) await tx.movimento_estoque.createMany({ data: missing.map(item => ({
          sync_uid: item.syncUid, livro_uid: item.bookUid, tipo: type, qtd: item.quantity,
          motivo: item.reason, referencia: reference, criado_em: now.toISOString(), origem: "nuvem",
          atualizado_em: now, sincronizado_em: now, criado_por: actor,
        })) });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Movimento duplicado");
      throw error;
    }
  }

  async divergences() {
    const rows = await this.db.divergencia_estoque.findMany({
      where: { status: "aberta", excluido_em: null }, orderBy: { criado_em: "desc" },
      select: { sync_uid: true, pedido_uid: true, item_pedido_uid: true, livro_uid: true,
        tipo: true, descricao: true, saldo_antes: true, qtd_evento: true, status: true,
        criado_em: true, resolvida_em: true, resolvida_por: true },
    });
    return rows.map(row => ({ ...row, saldo_antes: safeInteger(row.saldo_antes, "Saldo"),
      qtd_evento: safeInteger(row.qtd_evento, "Quantidade") }));
  }

  async decide(id: string, value: unknown, actor: string) {
    const syncUid = uuid(id);
    const status = divergenceStatus(value);
    const now = new Date();
    const updated = await this.db.divergencia_estoque.updateMany({
      where: { sync_uid: syncUid, status: "aberta", excluido_em: null },
      data: { status, resolvida_em: now, resolvida_por: actor, atualizado_em: now,
        sincronizado_em: now, origem: "escritorio" },
    });
    if (!updated.count) {
      const existing = await this.db.divergencia_estoque.findUnique({ where: { sync_uid: syncUid } });
      if (!existing || existing.excluido_em) throw new NotFoundException();
      throw new ConflictException("Divergencia ja tratada");
    }
    return { sync_uid: syncUid, status };
  }
}
