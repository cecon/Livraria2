import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { bookInput } from "./book-input";
import { uuid } from "../sync/validation";

@Injectable()
export class BooksService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(after?: string, includeInactive = false) {
    const rows = await this.db.livro.findMany({
      where: { excluidoEm: null, ...(!includeInactive && { ativo: true }),
        ...(after && { syncUid: { gt: uuid(after) } }) },
      orderBy: { syncUid: "asc" }, take: 501,
    });
    const items = rows.slice(0, 500).map(row => {
      if (row.precoCentavos < 0n || row.precoCentavos > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new ConflictException("Preco legado fora do contrato; reconciliacao necessaria");
      }
      return { sync_uid: row.syncUid, codigo: row.codigo, titulo: row.titulo, autor: row.autor,
        preco_centavos: Number(row.precoCentavos), categoria: row.categoria,
        descricao: row.descricao, ativo: row.ativo };
    });
    return { items, next: rows.length > 500 ? items[items.length - 1].sync_uid : null };
  }

  async save(id: string, input: unknown, actor: string, creating: boolean) {
    const uid = uuid(id);
    const { initial, ...data } = bookInput(input, creating);
    try {
      return await this.db.$transaction(async tx => {
        // Same lock order as sales: publish book and its initial stock in one commit.
        await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
        const now = new Date();
        if (creating) {
          await tx.livro.create({ data: { syncUid: uid, ...data, ativo: initial > 0n, criadoPor: actor,
            origem: "nuvem", atualizadoEm: now, sincronizadoEm: now } });
          if (initial > 0n) {
            await tx.movimento_estoque.create({ data: {
              sync_uid: randomUUID(), livro_uid: uid, tipo: "saldo_inicial", qtd: initial,
              criado_em: now.toISOString(), origem: "nuvem", criado_por: actor,
              atualizado_em: now, sincronizado_em: now,
            } });
            // Stock triggers also republish on installations that support it; final snapshot is authoritative.
            await tx.livro.update({ where: { syncUid: uid }, data: { atualizadoEm: now } });
          }
        } else {
          const existing = await tx.livro.findFirst({ where: { syncUid: uid, excluidoEm: null },
            select: { ativo: true } });
          if (!existing) throw new NotFoundException("Produto indisponivel");
          if (!existing.ativo && data.ativo === true) {
            const balance = await tx.$queryRaw<{ saldo: bigint }[]>`
              select coalesce(s.saldo,0)::bigint as saldo from public.vw_saldo_livro s
              where s.livro_uid=${uid}::uuid`;
            if (!balance[0] || balance[0].saldo <= 0n) {
              throw new ConflictException("Registre estoque positivo antes de reativar o produto");
            }
          }
          const changed = await tx.livro.updateMany({ where: { syncUid: uid, excluidoEm: null },
            data: { ...data, atualizadoEm: now, sincronizadoEm: now } });
          if (!changed.count) throw new NotFoundException("Produto indisponivel");
        }
        return { sync_uid: uid };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Ja existe produto com este UUID ou codigo");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const uid = uuid(id);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`select id from public.nuvem_sync_contador where id=1 for update`;
      const existing = await tx.livro.findUnique({ where: { syncUid: uid } });
      if (!existing) throw new NotFoundException();
      if (!existing.excluidoEm) {
        const now = new Date();
        await tx.livro.update({ where: { syncUid: uid },
          data: { excluidoEm: now, ativo: false, atualizadoEm: now, sincronizadoEm: now } });
      }
      return { sync_uid: uid, excluido: true };
    });
  }
}
