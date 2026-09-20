import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { ExecutionContext } from "../auth/shift-context.service";
import { decrypt, encrypt } from "./credentials";
import { input, Provider } from "./validation";
import { probe } from "./provider";

interface Row {
  uid: string; nome: string; provedor: Provider; endereco: string; modelo: string;
  credencial: string | null; ativo: boolean; pdv: boolean; retaguarda: boolean; versao: number;
}
function publicRow(row: Row) {
  const { credencial, ...config } = row;
  return { ...config, possuiCredencial: !!credencial };
}

@Injectable()
export class LlmService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(context?: ExecutionContext) {
    const rows = await this.db.$queryRaw<Row[]>`
      select uid::text,nome,provedor,endereco,modelo,credencial,ativo,pdv,retaguarda,versao
      from public.llm_configuracao order by lower(nome),uid`;
    return rows.filter(row => !context || (row.ativo && row[context.origem]))
      .map(row => context ? { uid: row.uid, nome: row.nome, provedor: row.provedor, modelo: row.modelo } : publicRow(row));
  }

  async save(uid: string, value: unknown, actor: string, create: boolean) {
    const data = input(value);
    const version = (value as { versao?: unknown }).versao;
    if (!create && (!Number.isSafeInteger(version) || Number(version) < 1)) throw new BadRequestException("Versão inválida");
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Row[]>`select * from public.llm_configuracao where uid=${uid}::uuid for update`;
      const current = rows[0];
      if (!create && !current) throw new NotFoundException();
      if (current && (create || current.versao !== version)) throw new ConflictException("Configuração alterada. Recarregue a lista.");
      if (current && (current.endereco !== data.endereco || current.provedor !== data.provedor) && current.credencial && !data.credencial) {
        throw new BadRequestException("Informe novamente a credencial ao trocar endereço ou provedor");
      }
      const secret = data.credencial ? encrypt(data.credencial, uid) : current?.credencial ?? null;
      if (data.provedor === "google" && !secret) throw new BadRequestException("Informe a credencial Google");
      if (create) {
        await tx.$executeRaw`insert into public.llm_configuracao
          (uid,nome,provedor,endereco,modelo,credencial,ativo,pdv,retaguarda,atualizado_por)
          values(${uid}::uuid,${data.nome},${data.provedor},${data.endereco},${data.modelo},${secret},
            ${data.ativo},${data.pdv},${data.retaguarda},${actor}::uuid)`;
      } else {
        await tx.$executeRaw`update public.llm_configuracao set nome=${data.nome},provedor=${data.provedor},
          endereco=${data.endereco},modelo=${data.modelo},credencial=${secret},ativo=${data.ativo},
          pdv=${data.pdv},retaguarda=${data.retaguarda},versao=versao+1,atualizado_em=now(),atualizado_por=${actor}::uuid
          where uid=${uid}::uuid`;
      }
      await tx.$executeRaw`insert into public.llm_auditoria(uid,configuracao_uid,usuario_uid,acao,resultado)
        values(${randomUUID()}::uuid,${uid}::uuid,${actor}::uuid,${create ? "criar" : "editar"},'OK')`;
      const saved = await tx.$queryRaw<Row[]>`select * from public.llm_configuracao where uid=${uid}::uuid`;
      // Explicit projection prevents internal database fields from entering responses.
      const row = saved[0];
      return publicRow({ uid: row.uid, nome: row.nome, provedor: row.provedor, endereco: row.endereco,
        modelo: row.modelo, credencial: row.credencial, ativo: row.ativo, pdv: row.pdv,
        retaguarda: row.retaguarda, versao: row.versao });
    });
  }

  async test(uid: string, context: ExecutionContext, administrative = false) {
    const rows = await this.db.$queryRaw<Row[]>`select * from public.llm_configuracao where uid=${uid}::uuid`;
    const row = rows[0];
    if (!row) throw new NotFoundException();
    if (!row.ativo || (!administrative && !row[context.origem])) throw new ForbiddenException("Configuração indisponível para esta origem");
    // Record intent before contacting a provider; no secrets or provider response bodies in audit.
    const attempt = randomUUID();
    await this.db.$executeRaw`insert into public.llm_auditoria
      (uid,configuracao_uid,usuario_uid,pdv_uid,turno_uid,acao,resultado)
      values(${attempt}::uuid,${uid}::uuid,${context.usuarioUid}::uuid,${context.pdvUid}::uuid,
        ${context.turnoUid}::uuid,'testar','INICIADO')`;
    try {
      const result = await probe(row, row.credencial ? decrypt(row.credencial, uid) : null);
      await this.db.$executeRaw`update public.llm_auditoria set resultado=${result.codigo} where uid=${attempt}::uuid`;
      return result;
    } catch (error) {
      await this.db.$executeRaw`update public.llm_auditoria set resultado='CONFIGURACAO' where uid=${attempt}::uuid`;
      throw error;
    }
  }
}
