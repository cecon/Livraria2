import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable,
  NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { booleanInput, normalize, objectInput, orderInput, textInput } from "./reference-input";

@Injectable()
export class DestinationsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(after?: string) {
    const rows = await this.db.destinacao.findMany({
      where: { excluido_em: null, ...(after && { sync_uid: { gt: uuid(after) } }) },
      orderBy: { sync_uid: "asc" }, take: 501,
      select: { sync_uid: true, nome: true, de_sistema: true, ativa: true, ordem: true },
    });
    return { items: rows.slice(0, 500), next: rows.length > 500 ? rows[499].sync_uid : null };
  }

  async save(id: string, value: unknown, actor: string, creating: boolean) {
    const uid = uuid(id);
    const input = objectInput(value);
    const nome = textInput(input.nome, 500, true)!;
    const ativa = booleanInput(input.ativa);
    const ordem = orderInput(input.ordem);
    try {
      return await this.db.$transaction(async tx => {
        await tx.$executeRaw`lock table public.destinacao in share row exclusive mode`;
        const now = new Date();
        const data = { nome, nome_norm: normalize(nome), ativa, ordem,
          atualizado_em: now, sincronizado_em: now, origem: "nuvem" };
        if (creating) {
          if (input.de_sistema !== undefined && input.de_sistema !== false) throw new ForbiddenException();
          await tx.destinacao.create({ data: { sync_uid: uid, de_sistema: false, criado_por: actor, ...data } });
        } else {
          const existing = await tx.destinacao.findUnique({ where: { sync_uid: uid } });
          if (!existing || existing.excluido_em) throw new NotFoundException();
          if (input.de_sistema !== undefined && input.de_sistema !== existing.de_sistema) {
            throw new BadRequestException("Classificacao imutavel");
          }
          if (existing.de_sistema && !ativa) throw new ForbiddenException();
          await tx.destinacao.update({ where: { sync_uid: uid }, data });
        }
        return { sync_uid: uid };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Destino duplicado");
      throw error;
    }
  }

  async active(id: string, value: unknown) {
    const uid = uuid(id);
    const ativa = booleanInput(objectInput(value).ativa);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.destinacao in share row exclusive mode`;
      const existing = await tx.destinacao.findUnique({ where: { sync_uid: uid } });
      if (!existing || existing.excluido_em) throw new NotFoundException();
      if (existing.de_sistema && !ativa) throw new ForbiddenException();
      const now = new Date();
      await tx.destinacao.update({ where: { sync_uid: uid },
        data: { ativa, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      return { sync_uid: uid, ativa };
    });
  }

  async remove(id: string) {
    const uid = uuid(id);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.destinacao in share row exclusive mode`;
      const existing = await tx.destinacao.findUnique({ where: { sync_uid: uid } });
      if (!existing) throw new NotFoundException();
      if (existing.de_sistema) throw new ForbiddenException();
      if (!existing.excluido_em) {
        const now = new Date();
        await tx.destinacao.update({ where: { sync_uid: uid }, data: { ativa: false,
          excluido_em: now, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      }
      return { sync_uid: uid, excluido: true };
    });
  }

  async reorder(value: unknown) {
    const input = objectInput(value).uids;
    if (!Array.isArray(input) || input.length > 500) throw new BadRequestException();
    const ids = input.map(uuid);
    if (new Set(ids).size !== ids.length) throw new BadRequestException("UUID duplicado");
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.destinacao in share row exclusive mode`;
      const free = await tx.destinacao.findMany({ where: { excluido_em: null, de_sistema: false },
        select: { sync_uid: true } });
      const requested = new Set(ids);
      if (free.length !== ids.length || free.some(row => !requested.has(row.sync_uid))) {
        throw new ConflictException("Lista mudou; recarregue antes de reordenar");
      }
      const now = new Date();
      for (const [index, sync_uid] of ids.entries()) {
        await tx.destinacao.update({ where: { sync_uid }, data: { ordem: index + 1,
          atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      }
      return { atualizado: true };
    });
  }
}
