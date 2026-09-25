import { BadRequestException, Body, Controller, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { AuthService } from "../auth/auth.service";
import { newRefreshCredential } from "../auth/device-credentials";
import { PrismaService } from "../database/prisma.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("pdv")
export class PdvPublicController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post("renovar")
  renew(@Body() body: { pdvUid?: unknown; refreshToken?: unknown }) {
    return this.auth.renewDevice(body?.pdvUid, body?.refreshToken);
  }

  @Post("configurar")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async configure(@Body() body: { nome?: unknown; usuario?: unknown; senha?: unknown }) {
    const name = typeof body?.nome === "string" ? body.nome.trim() : "";
    const user = typeof body?.usuario === "string" ? body.usuario.trim().toLowerCase() : "";
    const password = typeof body?.senha === "string" ? body.senha : "";
    if (!name || name.length > 100 || !user || user.length > 100 || !password || password.length > 200) {
      throw new BadRequestException("Dados invalidos");
    }
    await this.auth.login(user, password);
    const users = await this.db.$queryRaw<{ uid: string; perfil: string }[]>`
      select sync_uid::text as uid, perfil from public.usuario where usuario=${user}
        and ativo and excluido_em is null`;
    const owner = users[0];
    if (!owner || owner.perfil !== "admin" || !UUID.test(owner.uid)) throw new UnauthorizedException();
    const existing = await this.db.$queryRaw<{ uid: string }[]>`
      select uid::text from public.nuvem_pdv
      where ativo and lower(nome)=lower(${name}) order by criado_em desc limit 1`;
    const credential = newRefreshCredential();
    const uid = existing[0]?.uid ?? randomUUID();
    const rows = existing[0]
      ? await this.rotate(uid, credential.hash)
      : await this.register(uid, name, owner.uid, credential.hash);
    return { uid, refreshToken: credential.refreshToken, ...await this.auth.deviceToken(uid, rows[0].versao) };
  }

  private rotate(uid: string, hash: string) {
    return this.db.$queryRaw<{ versao: number }[]>`
      update public.nuvem_pdv set versao_token=versao_token+1,
        refresh_hash=${hash}, refresh_expira_em=now()+interval '90 days'
      where uid=${uid}::uuid and ativo returning versao_token as versao`;
  }

  private register(uid: string, name: string, owner: string, hash: string) {
    return this.db.$queryRaw<{ versao: number }[]>`
      insert into public.nuvem_pdv(uid,nome,usuario_uid,refresh_hash,refresh_expira_em)
      values(${uid}::uuid,${name},${owner}::uuid,${hash},now()+interval '90 days')
      returning versao_token as versao`;
  }
}
