import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { bookInput } from "./book-input";
import { bookListItem, bookListLimit, bookListQuery, BookListFilter, BookRow } from "./book-query";
import { uuid } from "../sync/validation";

@Injectable()
export class BooksService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(filter: BookListFilter = {}) {
    const limit = bookListLimit(filter.limit);
    const rows = await this.db.$queryRaw<BookRow[]>(bookListQuery(filter, limit));
    const items = rows.slice(0, limit).map(row => bookListItem(row, !!filter.summary));
    return { items, next: rows.length > limit ? items[items.length - 1].sync_uid : null };
  }

  async get(id: string) {
    const rows = await this.db.$queryRaw<BookRow[]>(bookListQuery({ uid: id, includeInactive: true }, 1));
    if (!rows.length) throw new NotFoundException("Produto indisponivel");
    return bookListItem(rows[0], false);
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
          const changed = await tx.livro.updateMany({ where: { syncUid: uid, excluidoEm: null },
            data: { ...data, atualizadoEm: now, sincronizadoEm: now } });
          if (!changed.count) throw new NotFoundException("Produto indisponivel");
        }
        return { sync_uid: uid };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2003") throw new BadRequestException("Imagem não encontrada. Envie novamente.");
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
