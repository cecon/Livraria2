import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service";
import { Principal } from "./principal";
import { refreshHash } from "./device-credentials";

interface Usuario { uid: string; usuario: string; nome: string | null; perfil: "admin" | "operador" }
interface Claims { sub: string; tipo: string; versao?: number; exp?: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_SESSION_SECONDS = 8 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(usuario: unknown, senha: unknown) {
    if (typeof usuario !== "string" || typeof senha !== "string" ||
      usuario.length > 100 || senha.length > 200 || !senha) {
      throw new UnauthorizedException("Credenciais invalidas");
    }
    const rows = await this.db.$queryRaw<Usuario[]>`
      select sync_uid::text as uid, usuario, nome, perfil from public.usuario
      where usuario = ${usuario.trim().toLowerCase()} and ativo and excluido_em is null
      and perfil in ('admin','operador') and senha_hash = crypt(${senha}, senha_hash)`;
    const user = rows[0];
    if (!user) throw new UnauthorizedException("Credenciais invalidas");
    return {
      accessToken: await this.jwt.signAsync({ sub: user.uid, tipo: "usuario" },
        { expiresIn: USER_SESSION_SECONDS }),
      expiresIn: USER_SESSION_SECONDS,
    };
  }

  async deviceToken(uid: string, versao: number) {
    return {
      accessToken: await this.jwt.signAsync({ sub: uid, tipo: "pdv", versao }),
      expiresIn: 900,
    };
  }

  async renewDevice(uid: unknown, credential: unknown) {
    if (typeof uid !== "string" || !UUID.test(uid) ||
      typeof credential !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(credential)) {
      throw new UnauthorizedException();
    }
    const hash = refreshHash(credential);
    const rows = await this.db.$queryRaw<{ versao: number }[]>`
      select d.versao_token as versao from public.nuvem_pdv d
      join public.usuario u on u.sync_uid = d.usuario_uid
      where d.uid = ${uid}::uuid and d.ativo and d.refresh_hash = ${hash}
      and d.refresh_expira_em > now() and u.ativo and u.excluido_em is null
      and u.perfil in ('admin','operador')`;
    if (!rows[0]) throw new UnauthorizedException();
    return this.deviceToken(uid, rows[0].versao);
  }

  async authenticate(token: string): Promise<Principal> {
    let claims: Claims;
    try {
      claims = await this.jwt.verifyAsync<Claims>(token, { algorithms: ["HS256"] });
    } catch {
      throw new UnauthorizedException();
    }
    if (!claims.exp || typeof claims.sub !== "string" ||
      !UUID.test(claims.sub)) throw new UnauthorizedException();
    if (claims.tipo === "usuario") {
      const users = await this.db.$queryRaw<Usuario[]>`
        select sync_uid::text as uid, usuario, nome, perfil from public.usuario
        where sync_uid = ${claims.sub}::uuid and ativo and excluido_em is null
        and perfil in ('admin','operador')`;
      if (!users[0]) throw new UnauthorizedException();
      return { ...users[0], tipo: "usuario" };
    }
    if (claims.tipo === "pdv" && Number.isInteger(claims.versao)) {
      const users = await this.db.$queryRaw<Usuario[]>`
        select u.sync_uid::text as uid, u.usuario, u.nome, u.perfil
        from public.nuvem_pdv d join public.usuario u on u.sync_uid = d.usuario_uid
        where d.uid = ${claims.sub}::uuid and d.ativo and d.versao_token = ${claims.versao}
          and u.ativo and u.excluido_em is null and u.perfil in ('admin','operador')`;
      if (users[0]) return { ...users[0], tipo: "pdv", pdvUid: claims.sub };
    }
    throw new UnauthorizedException();
  }

  async changePassword(principal: Principal, value: unknown) {
    if (principal.tipo !== "usuario") throw new ForbiddenException();
    const senha = typeof value === "object" && value !== null
      ? (value as { senha?: unknown }).senha : undefined;
    if (typeof senha !== "string" || senha.length < 8 || senha.length > 200) {
      throw new BadRequestException("A senha deve ter entre 8 e 200 caracteres");
    }
    const changed = await this.db.$executeRaw`update public.usuario set
      senha_hash=crypt(${senha},gen_salt('bf')),atualizado_em=now(),
      sincronizado_em=now(),origem='nuvem'
      where sync_uid=${principal.uid}::uuid and ativo and excluido_em is null`;
    if (!changed) throw new UnauthorizedException();
    return { atualizado: true };
  }
}
