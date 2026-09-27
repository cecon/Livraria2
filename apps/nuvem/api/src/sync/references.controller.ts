import { BadRequestException, Controller, Get, Header, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthRequest } from "../auth/principal";
import { PrismaService } from "../database/prisma.service";
import { device, uuid } from "./validation";

const resources = {
  usuario: Prisma.sql`select sync_uid::text, usuario, nome, perfil, senha_hash,
    coalesce(excluido_em, case when not ativo then now() end)::text as excluido_em from public.usuario`,
  forma_pagamento: Prisma.sql`select sync_uid::text, chave, rotulo, de_sistema, ativa, ordem,
    excluido_em::text from public.forma_pagamento`,
  destinacao: Prisma.sql`select sync_uid::text, nome, nome_norm, de_sistema, ativa, ordem,
    excluido_em::text from public.destinacao`,
};

@Controller("sync/referencias")
@UseGuards(AuthGuard)
export class ReferencesController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Get(":resource")
  @Header("Cache-Control", "no-store")
  async page(@Req() req: AuthRequest, @Param("resource") resource: string, @Query("after") after?: string) {
    device(req.principal);
    if (!Object.hasOwn(resources, resource)) throw new BadRequestException("Recurso invalido");
    const start = after ? uuid(after) : "00000000-0000-0000-0000-000000000000";
    const source = resources[resource as keyof typeof resources];
    const rows = await this.db.$queryRaw<Array<Record<string, unknown> & { sync_uid: string }>>(Prisma.sql`
      select * from (${source}) r where sync_uid::uuid > ${start}::uuid order by sync_uid::uuid limit 501`);
    const registros = rows.slice(0, 500);
    return { registros, proximo: rows.length > 500 ? registros.at(-1)!.sync_uid : null };
  }
}
