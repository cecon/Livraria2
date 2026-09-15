import { BadRequestException, ConflictException, Inject, Injectable,
  NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { entryHeader, entryItem } from "./entry-input";

function integer(value: bigint, label: string) {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

@Injectable()
export class EntriesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list() {
    const rows = await this.db.lancamento_entrada.findMany({ where: { excluido_em: null },
      orderBy: { data: "desc" }, take: 200,
      select: { sync_uid: true, data: true, status: true, fornecedor: { select: { nome: true } },
        item_lancamento: { where: { excluido_em: null },
          select: { qtd: true, custo_unit_centavos: true } } },
    });
    return rows.map(row => {
      const total = row.item_lancamento.reduce((sum, item) => sum + item.qtd * item.custo_unit_centavos, 0n);
      return { sync_uid: row.sync_uid, fornecedorNome: row.fornecedor?.nome ?? null,
        data: row.data, status: row.status, qtdItens: row.item_lancamento.length,
        totalCentavos: integer(total, "Total") };
    });
  }

  async get(id: string) {
    const syncUid = uuid(id);
    const row = await this.db.lancamento_entrada.findFirst({ where: { sync_uid: syncUid, excluido_em: null },
      select: { sync_uid: true, numero: true, status: true, fornecedor_uid: true,
        fornecedor: { select: { nome: true } }, item_lancamento: { where: { excluido_em: null },
          orderBy: { sincronizado_em: "asc" }, select: { sync_uid: true, qtd: true,
            custo_unit_centavos: true, livro: { select: { titulo: true } } } } },
    });
    if (!row) throw new NotFoundException("Lancamento nao encontrado");
    const items = row.item_lancamento.map(item => ({ sync_uid: item.sync_uid,
      titulo: item.livro.titulo, qtd: integer(item.qtd, "Quantidade"),
      custoUnitCentavos: integer(item.custo_unit_centavos, "Custo"),
      subtotalCentavos: integer(item.qtd * item.custo_unit_centavos, "Subtotal") }));
    return { sync_uid: row.sync_uid, numero: row.numero, status: row.status,
      fornecedorUid: row.fornecedor_uid, fornecedorNome: row.fornecedor?.nome ?? null,
      itens: items, totalCentavos: integer(items.reduce((sum, item) =>
        sum + BigInt(item.subtotalCentavos), 0n), "Total") };
  }

  async create(id: string, actor: string) {
    const syncUid = uuid(id);
    const now = new Date();
    try {
      await this.db.lancamento_entrada.create({ data: { sync_uid: syncUid, data: now.toISOString(),
        status: "rascunho", origem: "nuvem", criado_por: actor, atualizado_em: now,
        sincronizado_em: now } });
      return { sync_uid: syncUid };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Lancamento duplicado");
      throw error;
    }
  }

  async update(id: string, value: unknown) {
    const syncUid = uuid(id);
    const input = entryHeader(value);
    if (input.supplierUid) {
      const supplier = await this.db.fornecedor.findFirst({ where: {
        sync_uid: input.supplierUid, excluido_em: null, ativo: true } });
      if (!supplier) throw new NotFoundException("Fornecedor indisponivel");
    }
    const now = new Date();
    const changed = await this.db.lancamento_entrada.updateMany({
      where: { sync_uid: syncUid, status: "rascunho", excluido_em: null },
      data: { fornecedor_uid: input.supplierUid, numero: input.number,
        atualizado_em: now, sincronizado_em: now, origem: "nuvem" },
    });
    if (!changed.count) await this.draftFailure(syncUid);
    return { sync_uid: syncUid };
  }

  async addItem(id: string, value: unknown, actor: string) {
    const entryUid = uuid(id);
    const input = entryItem(value);
    try {
      await this.db.$transaction(async tx => {
        const entry = await tx.lancamento_entrada.findFirst({ where: {
          sync_uid: entryUid, status: "rascunho", excluido_em: null } });
        if (!entry) await this.draftFailure(entryUid);
        const book = await tx.livro.findFirst({ where: { syncUid: input.bookUid, excluidoEm: null, ativo: true } });
        if (!book) throw new NotFoundException("Produto indisponivel");
        const now = new Date();
        await tx.item_lancamento.create({ data: { sync_uid: input.syncUid, lancamento_uid: entryUid,
          livro_uid: input.bookUid, qtd: input.quantity, custo_unit_centavos: input.unitCost,
          origem: "nuvem", criado_por: actor, atualizado_em: now, sincronizado_em: now } });
      });
      return { sync_uid: input.syncUid };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Item duplicado");
      throw error;
    }
  }

  async removeItem(id: string, itemId: string) {
    const entryUid = uuid(id);
    const itemUid = uuid(itemId);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select sync_uid from public.lancamento_entrada where sync_uid=${entryUid}::uuid for update`;
      const entry = await tx.lancamento_entrada.findUnique({ where: { sync_uid: entryUid } });
      if (!entry || entry.excluido_em) throw new NotFoundException();
      if (entry.status !== "rascunho") throw new ConflictException("Lancamento nao editavel");
      const now = new Date();
      const changed = await tx.item_lancamento.updateMany({ where: {
        sync_uid: itemUid, lancamento_uid: entryUid, excluido_em: null },
        data: { excluido_em: now, atualizado_em: now, sincronizado_em: now } });
      if (!changed.count) throw new NotFoundException("Item nao encontrado");
      return { sync_uid: itemUid, excluido: true };
    });
  }

  private async draftFailure(id: string): Promise<never> {
    const existing = await this.db.lancamento_entrada.findUnique({ where: { sync_uid: id } });
    if (!existing || existing.excluido_em) throw new NotFoundException("Lancamento nao encontrado");
    throw new ConflictException("Lancamento nao editavel");
  }

  async finalize(id: string, actor: string) { return this.transition(id, actor, false); }
  async cancel(id: string, actor: string) { return this.transition(id, actor, true); }

  private async transition(id: string, actor: string, canceling: boolean) {
    const entryUid = uuid(id);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
      const locked = await tx.$queryRaw<{ status: string; excluido_em: Date | null }[]>`
        select status, excluido_em from public.lancamento_entrada where sync_uid=${entryUid}::uuid for update`;
      const entry = locked[0];
      if (!entry || entry.excluido_em) throw new NotFoundException("Lancamento nao encontrado");
      const target = canceling ? "cancelada" : "finalizada";
      if (entry.status === target) return { status: target };
      if ((!canceling && entry.status !== "rascunho") || (canceling && entry.status !== "finalizada")) {
        throw new ConflictException("Transicao de lancamento invalida");
      }
      const items = await tx.item_lancamento.findMany({ where: { lancamento_uid: entryUid, excluido_em: null } });
      if (!items.length) throw new BadRequestException("Adicione itens antes de dar entrada");
      await tx.$executeRaw`lock table public.movimento_estoque in share row exclusive mode`;
      const now = new Date();
      for (const item of items) {
        const kind = canceling ? "estorno" : "entrada";
        const reference = `lancamento:${entryUid}:${kind}:${item.sync_uid}`;
        const movement = await tx.movimento_estoque.findFirst({ where: { referencia: reference, excluido_em: null } });
        if (movement) continue;
        await tx.movimento_estoque.create({ data: { sync_uid: randomUUID(), livro_uid: item.livro_uid,
          tipo: canceling ? "ajuste" : "entrada", qtd: canceling ? -item.qtd : item.qtd,
          custo_unit_centavos: canceling ? null : item.custo_unit_centavos,
          motivo: canceling ? "estorno de lancamento" : null, referencia: reference,
          criado_em: now.toISOString(), origem: "nuvem", criado_por: actor,
          atualizado_em: now, sincronizado_em: now } });
      }
      await tx.lancamento_entrada.update({ where: { sync_uid: entryUid }, data: {
        status: target, ...(canceling ? {} : { finalizada_em: now.toISOString() }),
        atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      return { status: target };
    }, { timeout: 10000 });
  }

  async remove(id: string) {
    const syncUid = uuid(id);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select sync_uid from public.lancamento_entrada where sync_uid=${syncUid}::uuid for update`;
      const entry = await tx.lancamento_entrada.findUnique({ where: { sync_uid: syncUid } });
      if (!entry || entry.excluido_em) throw new NotFoundException();
      if (entry.status !== "rascunho") throw new ConflictException("Somente rascunho pode ser excluido");
      const now = new Date();
      await tx.item_lancamento.updateMany({ where: { lancamento_uid: syncUid, excluido_em: null },
        data: { excluido_em: now, atualizado_em: now, sincronizado_em: now } });
      await tx.lancamento_entrada.update({ where: { sync_uid: syncUid }, data: {
        excluido_em: now, atualizado_em: now, sincronizado_em: now } });
      return { sync_uid: syncUid, excluido: true };
    });
  }
}
