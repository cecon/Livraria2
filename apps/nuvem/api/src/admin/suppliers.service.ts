import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { booleanInput, normalize, objectInput, textInput } from "./reference-input";

@Injectable()
export class SuppliersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(after?: string) {
    const rows = await this.db.fornecedor.findMany({
      where: { excluido_em: null, ...(after && { sync_uid: { gt: uuid(after) } }) },
      orderBy: { sync_uid: "asc" }, take: 501,
      select: { sync_uid: true, nome: true, documento: true, telefone: true, email: true, observacoes: true, ativo: true },
    });
    return { items: rows.slice(0, 500), next: rows.length > 500 ? rows[499].sync_uid : null };
  }

  async save(id: string, value: unknown, actor: string, creating: boolean) {
    const uid = uuid(id);
    const input = objectInput(value);
    const nome = textInput(input.nome, 500, true)!;
    const now = new Date();
    const data = { nome, nome_norm: normalize(nome), documento: textInput(input.documento, 100),
      telefone: textInput(input.telefone, 100), email: textInput(input.email, 320),
      observacoes: textInput(input.observacoes, 5000), ativo: booleanInput(input.ativo ?? true),
      origem: "nuvem", atualizado_em: now, sincronizado_em: now };
    try {
      if (creating) await this.db.fornecedor.create({ data: { sync_uid: uid, criado_por: actor, ...data } });
      else {
        const result = await this.db.fornecedor.updateMany({ where: { sync_uid: uid, excluido_em: null }, data });
        if (!result.count) throw new NotFoundException();
      }
      return { sync_uid: uid };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Fornecedor duplicado");
      throw error;
    }
  }

  async remove(id: string) {
    const uid = uuid(id);
    const now = new Date();
    const result = await this.db.fornecedor.updateMany({ where: { sync_uid: uid, excluido_em: null },
      data: { ativo: false, excluido_em: now, atualizado_em: now, sincronizado_em: now } });
    if (!result.count && !await this.db.fornecedor.findUnique({ where: { sync_uid: uid } })) throw new NotFoundException();
    return { sync_uid: uid, excluido: true };
  }
}
