import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Principal } from "./principal";
import { uuid } from "../sync/validation";

export interface ExecutionContext {
  usuarioUid: string;
  perfil: "admin" | "operador";
  origem: "pdv" | "retaguarda";
  pdvUid: string | null;
  turnoUid: string | null;
}

@Injectable()
export class ShiftContextService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async resolve(principal: Principal, shift?: unknown): Promise<ExecutionContext> {
    if (principal.tipo === "usuario") {
      return { usuarioUid: principal.uid, perfil: principal.perfil,
        origem: "retaguarda", pdvUid: null, turnoUid: null };
    }
    if (!principal.pdvUid) throw new ForbiddenException("Máquina inválida");
    const turnoUid = uuid(shift);
    const rows = await this.db.$queryRaw<{ uid: string; perfil: "admin" | "operador" }[]>`
      select u.sync_uid::text as uid, u.perfil from public.turno_operacao t
      join public.usuario u on u.sync_uid=t.operador_uid
      join public.nuvem_pdv d on d.uid=t.pdv_uid
      where t.sync_uid=${turnoUid}::uuid and t.pdv_uid=${principal.pdvUid}::uuid
        and t.status='aberto' and t.encerramento is null and t.excluido_em is null
        and d.ativo and u.ativo and u.excluido_em is null and u.perfil in ('admin','operador')`;
    if (!rows[0]) throw new ForbiddenException("O turno deve estar aberto e sincronizado nesta máquina, com operador ativo");
    return { usuarioUid: rows[0].uid, perfil: rows[0].perfil, origem: "pdv",
      pdvUid: principal.pdvUid, turnoUid };
  }
}
