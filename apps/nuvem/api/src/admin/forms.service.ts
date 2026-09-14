import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { booleanInput, normalize, objectInput, orderInput, textInput } from "./reference-input";

@Injectable()
export class FormsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(after?: string) {
    const rows = await this.db.forma_pagamento.findMany({
      where: { excluido_em: null, ...(after && { sync_uid: { gt: uuid(after) } }) },
      orderBy: { sync_uid: "asc" }, take: 501,
      select: { sync_uid: true, chave: true, rotulo: true, de_sistema: true, ativa: true, ordem: true },
    });
    return { items: rows.slice(0, 500), next: rows.length > 500 ? rows[499].sync_uid : null };
  }

  async save(id: string, value: unknown, actor: string, creating: boolean) {
    const uid = uuid(id);
    const input = objectInput(value);
    const rotulo = textInput(input.rotulo, 500, true)!;
    const ativa = booleanInput(input.ativa);
    const ordem = orderInput(input.ordem);
    try {
      return await this.db.$transaction(async tx => {
        await tx.$executeRaw`lock table public.forma_pagamento in share row exclusive mode`;
        const now = new Date();
        const data = { rotulo, ativa, ordem, atualizado_em: now, sincronizado_em: now, origem: "nuvem" };
        if (creating) {
          if (input.de_sistema !== undefined && input.de_sistema !== false) throw new ForbiddenException();
          const chave = input.chave === undefined ? normalize(rotulo).replace(/\s+/g, "_") : textInput(input.chave, 100, true)!;
          if (!chave || chave.length > 100) throw new BadRequestException("Chave invalida");
          await tx.forma_pagamento.create({ data: { sync_uid: uid, chave, ...data, criado_por: actor } });
        } else {
          const existing = await tx.forma_pagamento.findUnique({ where: { sync_uid: uid } });
          if (!existing || existing.excluido_em) throw new NotFoundException();
          if ((input.chave !== undefined && input.chave !== existing.chave) ||
              (input.de_sistema !== undefined && input.de_sistema !== existing.de_sistema)) {
            throw new BadRequestException("Chave e classificacao sao imutaveis");
          }
          if (existing.de_sistema && !ativa) throw new ForbiddenException();
          await tx.forma_pagamento.update({ where: { sync_uid: uid }, data });
        }
        return { sync_uid: uid };
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Forma duplicada");
      throw error;
    }
  }

  async active(id: string, value: unknown) {
    const uid = uuid(id);
    const ativa = booleanInput(objectInput(value).ativa);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.forma_pagamento in share row exclusive mode`;
      const existing = await tx.forma_pagamento.findUnique({ where: { sync_uid: uid } });
      if (!existing || existing.excluido_em) throw new NotFoundException();
      if (existing.de_sistema && !ativa) throw new ForbiddenException();
      const now = new Date();
      await tx.forma_pagamento.update({ where: { sync_uid: uid },
        data: { ativa, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      return { sync_uid: uid, ativa };
    });
  }

  async remove(id: string) {
    const uid = uuid(id);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.forma_pagamento in share row exclusive mode`;
      const existing = await tx.forma_pagamento.findUnique({ where: { sync_uid: uid } });
      if (!existing) throw new NotFoundException();
      if (existing.de_sistema) throw new ForbiddenException();
      if (!existing.excluido_em) {
        const now = new Date();
        await tx.forma_pagamento.update({ where: { sync_uid: uid },
          data: { ativa: false, excluido_em: now, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      }
      return { sync_uid: uid, excluido: true };
    });
  }

  async reorder(value: unknown) {
    const input = objectInput(value).uids;
    if (!Array.isArray(input) || input.length > 500) throw new BadRequestException();
    const ids = input.map(uuid);
    if (new Set(ids.map(id => id.toLowerCase())).size !== ids.length) throw new BadRequestException("UUID duplicado");
    return this.db.$transaction(async tx => {
      // Protect the entire membership from inserts/deletes while validating and ordering.
      await tx.$executeRaw`lock table public.forma_pagamento in share row exclusive mode`;
      const current = await tx.forma_pagamento.findMany({ where: { excluido_em: null }, select: { sync_uid: true } });
      const requested = new Set(ids.map(id => id.toLowerCase()));
      if (current.length !== ids.length || current.some(row => !requested.has(row.sync_uid))) {
        throw new ConflictException("Lista mudou; recarregue antes de reordenar");
      }
      const now = new Date();
      for (const [ordem, sync_uid] of ids.entries()) {
        await tx.forma_pagamento.update({ where: { sync_uid },
          data: { ordem, atualizado_em: now, sincronizado_em: now, origem: "nuvem" } });
      }
      return { atualizado: true };
    });
  }
}
