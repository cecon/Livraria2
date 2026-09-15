import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { AuthRequest } from "../auth/principal";
import { PrismaService } from "../database/prisma.service";
import { admin, uuid } from "./validation";
import { newRefreshCredential } from "../auth/device-credentials";

@Controller("pdvs")
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post()
  async register(@Req() req: AuthRequest, @Body() body: { nome?: unknown; usuarioUid?: unknown }) {
    admin(req.principal);
    const owner = uuid(body?.usuarioUid);
    if (typeof body?.nome !== "string" || !body.nome.trim() || body.nome.length > 100) {
      throw new BadRequestException("Nome invalido");
    }
    const users = await this.db.$queryRaw<{ uid: string }[]>`
      select sync_uid::text as uid from public.usuario where sync_uid = ${owner}::uuid
        and ativo and excluido_em is null and perfil in ('admin','operador')`;
    if (!users[0]) throw new BadRequestException("Usuario indisponivel");
    const uid = randomUUID();
    const credential = newRefreshCredential();
    await this.db.$executeRaw`
      insert into public.nuvem_pdv(uid,nome,usuario_uid,refresh_hash,refresh_expira_em)
      values(${uid}::uuid,${body.nome.trim()},${owner}::uuid,${credential.hash},now()+interval '90 days')`;
    return { uid, refreshToken: credential.refreshToken, ...await this.auth.deviceToken(uid, 1) };
  }

  @Post(":uid/token")
  async rotate(@Req() req: AuthRequest, @Param("uid") id: string) {
    admin(req.principal);
    const uid = uuid(id);
    const credential = newRefreshCredential();
    const rows = await this.db.$queryRaw<{ versao: number }[]>`
      update public.nuvem_pdv set versao_token = versao_token + 1,
        refresh_hash = ${credential.hash}, refresh_expira_em = now()+interval '90 days'
      where uid = ${uid}::uuid and ativo returning versao_token as versao`;
    if (!rows[0]) throw new NotFoundException();
    return { refreshToken: credential.refreshToken, ...await this.auth.deviceToken(uid, rows[0].versao) };
  }

  @Put(":uid")
  async update(@Req() req: AuthRequest, @Param("uid") id: string,
    @Body() body: { nome?: unknown; usuarioUid?: unknown }) {
    admin(req.principal);
    const deviceUid = uuid(id);
    const ownerUid = uuid(body?.usuarioUid);
    if (typeof body?.nome !== "string" || !body.nome.trim() || body.nome.length > 100) {
      throw new BadRequestException("Nome invalido");
    }
    const name = body.nome.trim();
    const users = await this.db.$queryRaw<{ uid: string }[]>`
      select sync_uid::text as uid from public.usuario where sync_uid = ${ownerUid}::uuid
        and ativo and excluido_em is null and perfil in ('admin','operador')`;
    if (!users[0]) throw new BadRequestException("Usuario indisponivel");
    const credential = newRefreshCredential();
    const rows = await this.db.$queryRaw<{ ownerChanged: boolean; version: number }[]>`
      with current as (
        select usuario_uid from public.nuvem_pdv where uid=${deviceUid}::uuid and ativo for update
      ), updated as (
        update public.nuvem_pdv d set nome=${name}, usuario_uid=${ownerUid}::uuid,
          versao_token=d.versao_token + case when current.usuario_uid <> ${ownerUid}::uuid then 1 else 0 end,
          refresh_hash=case when current.usuario_uid <> ${ownerUid}::uuid then ${credential.hash} else d.refresh_hash end,
          refresh_expira_em=case when current.usuario_uid <> ${ownerUid}::uuid
            then now()+interval '90 days' else d.refresh_expira_em end
        from current where d.uid=${deviceUid}::uuid
        returning current.usuario_uid <> ${ownerUid}::uuid as "ownerChanged", d.versao_token as version
      ) select * from updated`;
    const result = rows[0];
    if (!result) throw new NotFoundException();
    if (!result.ownerChanged) return { uid: deviceUid, atualizado: true };
    return { uid: deviceUid, atualizado: true, refreshToken: credential.refreshToken,
      ...await this.auth.deviceToken(deviceUid, result.version) };
  }

  @Post(":uid/desativar")
  async disable(@Req() req: AuthRequest, @Param("uid") id: string) {
    admin(req.principal);
    const uid = uuid(id);
    await this.db.$executeRaw`
      update public.nuvem_pdv set ativo=false, refresh_hash=null, versao_token=versao_token+1
      where uid=${uid}::uuid`;
    return { uid, ativo: false };
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    admin(req.principal);
    return this.db.$queryRaw`
      select d.uid::text, d.nome, d.ativo, d.usuario_uid::text as "usuarioUid",
        u.usuario, u.nome as "usuarioNome", d.cursor_aplicado::text as "cursorAplicado",
        d.cursor_entregue::text as "cursorEntregue", d.confirmado_em as "confirmadoEm",
        c.sequencia::text as "cursorDisponivel"
      from public.nuvem_pdv d join public.usuario u on u.sync_uid=d.usuario_uid
      cross join public.nuvem_sync_contador c order by d.nome limit 1000`;
  }
}
