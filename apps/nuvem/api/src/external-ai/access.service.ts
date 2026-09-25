import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { AuthService } from "../auth/auth.service";
import { Principal } from "../auth/principal";
import { uuid } from "../sync/validation";
import { object } from "./validation";

export type IaAccess = { uid: string; usuario_uid: string; modo: "consulta" | "alteracao"; expira_em: Date; perfil: "admin" | "operador" };
export const iaHash = (token: string) => createHash("sha256").update(token).digest("hex");
const b64 = (value: Buffer) => value.toString("base64url");
const scopes = ["livraria:read", "livraria:write", "mcp:tools"];

@Injectable()
export class IaAccessService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuthService) private readonly auth: AuthService) {}
  async request(value: unknown) {
    const v = object(value);
    const text = (key: string, max: number) => {
      if (typeof v[key] !== "string" || !(v[key] as string).trim() || (v[key] as string).length > max) throw new BadRequestException(`Confira ${key}`);
      return (v[key] as string).trim();
    };
    const client = text("cliente", 80), purpose = text("finalidade", 300), uid = randomUUID();
    const expires = new Date(Date.now() + 10 * 60000);
    await this.db.$executeRaw`insert into public.ia_solicitacao(uid,cliente,finalidade,expira_em) values(${uid}::uuid,${client},${purpose},${expires})`;
    return { uid, autorizar: `/ia/autorizar?solicitacao=${uid}`, expiraEm: expires,
      instrucao: "Peça ao humano para abrir autorizar no mesmo domínio e colar o token no chat. Nunca peça usuário ou senha no chat." };
  }
  async details(id: string) {
    const [r] = await this.db.$queryRaw<{ uid: string; cliente: string; finalidade: string; expira_em: Date; autorizado_em: Date | null }[]>`
      select uid,cliente,finalidade,expira_em,autorizado_em from public.ia_solicitacao where uid=${uuid(id)}::uuid`;
    if (!r) throw new NotFoundException("Solicitação não encontrada.");
    return { uid: r.uid, cliente: r.cliente, finalidade: r.finalidade, expiraEm: r.expira_em,
      estado: r.autorizado_em ? "autorizada" : r.expira_em <= new Date() ? "expirada" : "pendente" };
  }
  async authorize(value: unknown) {
    const v = object(value), id = uuid(v.solicitacaoUid);
    if (!["consulta", "alteracao"].includes(String(v.modo)) || ![15, 60, 240].includes(Number(v.minutos))) throw new BadRequestException("Permissão ou duração inválida.");
    const session = await this.auth.login(v.usuario, v.senha);
    const user = await this.auth.authenticate(session.accessToken);
    const token = `lia_${randomBytes(32).toString("base64url")}`, hash = iaHash(token), uid = randomUUID();
    const expires = new Date(Date.now() + Number(v.minutos) * 60000);
    await this.db.$transaction(async tx => {
      const changed = await tx.$executeRaw`update public.ia_solicitacao set autorizado_em=now()
        where uid=${id}::uuid and autorizado_em is null and expira_em>now()`;
      if (!changed) throw new ConflictException("Solicitação já autorizada ou expirada. Crie outro link.");
      await tx.$executeRaw`insert into public.ia_acesso(uid,solicitacao_uid,usuario_uid,token_hash,modo,expira_em)
        values(${uid}::uuid,${id}::uuid,${user.uid}::uuid,${hash},${String(v.modo)},${expires})`;
    });
    // The human receives this once. Neither polling nor the authorization URL can recover it.
    return { uid, token, expiraEm: expires, modo: v.modo, usuario: user.usuario };
  }
  async authenticate(header: string | undefined): Promise<IaAccess> {
    const match = /^Bearer (lia_[A-Za-z0-9_-]{43})$/.exec(header || "");
    if (!match) throw new UnauthorizedException("Informe o token temporário no cabeçalho Authorization.");
    const hash = iaHash(match[1]);
    const [access] = await this.db.$queryRaw<IaAccess[]>`select a.uid,a.usuario_uid,a.modo,a.expira_em,u.perfil
      from public.ia_acesso a join public.usuario u on u.sync_uid=a.usuario_uid
      where token_hash=${hash} and revogado_em is null and expira_em>now()
      and u.ativo and u.excluido_em is null and u.perfil in ('admin','operador')`;
    if (!access) throw new UnauthorizedException("Acesso expirado, revogado ou indisponível. Peça nova autorização.");
    return access;
  }
  async authenticateMcp(header: string | undefined, resource: string): Promise<IaAccess> {
    const access = await this.authenticate(header);
    const [row] = await this.db.$queryRaw<{ oauth_resource: string | null; oauth_scope: string | null }[]>`
      select oauth_resource,oauth_scope from public.ia_acesso where uid=${access.uid}::uuid`;
    if (!row?.oauth_resource || row.oauth_resource !== resource || !row.oauth_scope?.includes("mcp:tools")) {
      throw new UnauthorizedException("Autorize novamente este conector para o recurso MCP correto.");
    }
    return access;
  }
  protectedResource(resource: string, issuer: string) {
    return { resource, authorization_servers: [issuer], scopes_supported: scopes,
      bearer_methods_supported: ["header"], resource_name: "Livraria" };
  }
  authorizationServer(issuer: string, endpointsBase = issuer) {
    return { issuer, authorization_endpoint: `${endpointsBase}/oauth/authorize`, token_endpoint: `${endpointsBase}/oauth/token`,
      registration_endpoint: `${endpointsBase}/oauth/register`, response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"], token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"], scopes_supported: scopes,
      authorization_response_iss_parameter_supported: true, client_id_metadata_document_supported: true };
  }
  async registerClient(value: unknown) {
    const v = object(value);
    const uris = Array.isArray(v.redirect_uris) ? v.redirect_uris.map(String) : [];
    if (!uris.length || uris.length > 10 || uris.some(uri => !this.safeRedirect(uri))) throw new BadRequestException("redirect_uris inválidos.");
    const name = typeof v.client_name === "string" && v.client_name.trim() ? v.client_name.trim().slice(0, 120) : "Cliente MCP";
    const id = `lia_client_${randomBytes(18).toString("base64url")}`;
    await this.db.$executeRaw`insert into public.ia_oauth_client(client_id,client_name,redirect_uris)
      values(${id},${name},${JSON.stringify(uris)}::jsonb)`;
    return { client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: name,
      redirect_uris: uris, grant_types: ["authorization_code"], response_types: ["code"],
      token_endpoint_auth_method: "none" };
  }
  async authorizePage(query: Record<string, unknown>) {
    const p = this.authParams(query);
    const client = await this.client(p.client_id, p.redirect_uri);
    return { ...p, clientName: client.client_name, modo: p.scope.includes("livraria:write") ? "alteracao" : "consulta" };
  }
  async authorizeOAuth(value: unknown, issuer: string) {
    const v = object(value), p = this.authParams(v);
    await this.client(p.client_id, p.redirect_uri);
    const mode = p.scope.includes("livraria:write") ? "alteracao" : "consulta";
    const session = await this.auth.login(v.usuario, v.senha);
    const user = await this.auth.authenticate(session.accessToken);
    const code = `lic_${randomBytes(32).toString("base64url")}`, uid = randomUUID();
    await this.db.$executeRaw`insert into public.ia_oauth_code(uid,code_hash,client_id,redirect_uri,code_challenge,resource,scope,usuario_uid,modo,expira_em)
      values(${uid}::uuid,${iaHash(code)},${p.client_id},${p.redirect_uri},${p.code_challenge},${p.resource},${p.scope},${user.uid}::uuid,${mode},now()+interval '5 minutes')`;
    const redirect = new URL(p.redirect_uri);
    redirect.searchParams.set("code", code);
    if (p.state) redirect.searchParams.set("state", p.state);
    redirect.searchParams.set("iss", issuer);
    return { redirect: redirect.toString() };
  }
  async token(value: unknown) {
    const v = object(value);
    if (v.grant_type !== "authorization_code" || typeof v.code !== "string" || typeof v.code_verifier !== "string") {
      throw new BadRequestException("grant_type, code e code_verifier são obrigatórios.");
    }
    const rows = await this.db.$queryRaw<{ uid: string; client_id: string; redirect_uri: string; code_challenge: string; resource: string;
      scope: string; usuario_uid: string; modo: "consulta" | "alteracao"; expira_em: Date }[]>`
      select uid,client_id,redirect_uri,code_challenge,resource,scope,usuario_uid,modo,expira_em
      from public.ia_oauth_code where code_hash=${iaHash(v.code)} and usado_em is null and expira_em>now()`;
    const code = rows[0];
    if (!code || code.client_id !== v.client_id || code.redirect_uri !== v.redirect_uri ||
      (typeof v.resource === "string" && v.resource !== code.resource) || !this.verifyPkce(String(v.code_verifier), code.code_challenge)) {
      throw new UnauthorizedException("Código OAuth inválido.");
    }
    const token = `lia_${randomBytes(32).toString("base64url")}`, hash = iaHash(token), accessUid = randomUUID(), requestUid = randomUUID();
    const expires = new Date(Date.now() + 60 * 60000);
    await this.db.$transaction(async tx => {
      const changed = await tx.$executeRaw`update public.ia_oauth_code set usado_em=now() where uid=${code.uid}::uuid and usado_em is null`;
      if (!changed) throw new ConflictException("Código OAuth já utilizado.");
      await tx.$executeRaw`insert into public.ia_solicitacao(uid,cliente,finalidade,expira_em,autorizado_em)
        values(${requestUid}::uuid,${code.client_id},${code.resource},${expires},now())`;
      await tx.$executeRaw`insert into public.ia_acesso(uid,solicitacao_uid,usuario_uid,token_hash,modo,expira_em,oauth_client_id,oauth_resource,oauth_scope)
        values(${accessUid}::uuid,${requestUid}::uuid,${code.usuario_uid}::uuid,${hash},${code.modo},${expires},${code.client_id},${code.resource},${code.scope})`;
    });
    return { access_token: token, token_type: "Bearer", expires_in: 3600, scope: code.scope, resource: code.resource };
  }
  async list(user: Principal) {
    if (user.tipo !== "usuario") throw new ForbiddenException();
    return this.db.$queryRaw`select a.uid,a.modo,a.criado_em,a.expira_em,a.revogado_em,a.ultimo_uso_em,s.cliente,s.finalidade
      from public.ia_acesso a join public.ia_solicitacao s on s.uid=a.solicitacao_uid
      where a.usuario_uid=${user.uid}::uuid order by a.criado_em desc limit 100`;
  }
  async revoke(id: string, user: Principal) {
    if (user.tipo !== "usuario") throw new ForbiddenException();
    const n = await this.db.$executeRaw`update public.ia_acesso set revogado_em=coalesce(revogado_em,now())
      where uid=${uuid(id)}::uuid and usuario_uid=${user.uid}::uuid`;
    if (!n) throw new NotFoundException();
    return { revogado: true };
  }
  async history(id: string, user: Principal) {
    if (user.tipo !== "usuario") throw new ForbiddenException();
    const owned = await this.db.$queryRaw`select uid from public.ia_acesso where uid=${uuid(id)}::uuid and usuario_uid=${user.uid}::uuid`;
    if (!(owned as unknown[]).length) throw new NotFoundException();
    return this.db.$queryRaw`select metodo,rota,status,criado_em,concluido_em from public.ia_requisicao
      where acesso_uid=${id}::uuid order by criado_em desc limit 100`;
  }
  private authParams(v: Record<string, unknown>) {
    const response_type = String(v.response_type || ""); const client_id = String(v.client_id || "");
    const redirect_uri = String(v.redirect_uri || ""); const code_challenge = String(v.code_challenge || "");
    const method = String(v.code_challenge_method || ""); const resource = String(v.resource || "");
    const scope = String(v.scope || "livraria:read mcp:tools");
    if (response_type !== "code" || !client_id || !this.safeRedirect(redirect_uri) || method !== "S256" ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(code_challenge) || !this.safeRedirect(resource)) {
      throw new BadRequestException("Parâmetros OAuth inválidos.");
    }
    const allowed = scope.split(/\s+/).filter(Boolean);
    if (!allowed.includes("mcp:tools") || allowed.some(s => !scopes.includes(s))) throw new BadRequestException("Escopo OAuth inválido.");
    return { response_type, client_id, redirect_uri, code_challenge, resource, scope: allowed.join(" "), state: typeof v.state === "string" ? v.state : "" };
  }
  private async client(clientId: string, redirectUri: string) {
    if (this.safeRedirect(clientId)) {
      try { return await this.clientByMetadata(clientId, redirectUri); }
      catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException("Identidade OAuth publicada inválida."); }
    }
    const [client] = await this.db.$queryRaw<{ client_name: string; redirect_uris: unknown }[]>`
      select client_name,redirect_uris from public.ia_oauth_client where client_id=${clientId}`;
    const uris = Array.isArray(client?.redirect_uris) ? client.redirect_uris.map(String) : [];
    if (!client || !uris.includes(redirectUri)) throw new UnauthorizedException("Cliente OAuth não registrado para este retorno.");
    return client;
  }
  private async clientByMetadata(clientId: string, redirectUri: string) {
    const controller = AbortSignal.timeout(5000);
    let response: Response;
    try { response = await fetch(clientId, { redirect: "error", signal: controller, headers: { accept: "application/json" } }); }
    catch { throw new UnauthorizedException("Não foi possível ler a identidade publicada do cliente OAuth."); }
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 20000) throw new UnauthorizedException("Identidade OAuth publicada inválida.");
    const text = await response.text();
    if (text.length > 20000) throw new UnauthorizedException("Identidade OAuth publicada excessiva.");
    let metadata: Record<string, unknown>;
    try { metadata = JSON.parse(text); } catch { throw new UnauthorizedException("Identidade OAuth publicada não é JSON."); }
    const uris = Array.isArray(metadata.redirect_uris) ? metadata.redirect_uris.map(String) : [];
    if ((metadata.client_id && metadata.client_id !== clientId) || !uris.includes(redirectUri)) {
      throw new UnauthorizedException("Identidade OAuth publicada não permite este retorno.");
    }
    const method = String(metadata.token_endpoint_auth_method || "none");
    if (method !== "none" || uris.some(uri => !this.safeRedirect(uri))) throw new UnauthorizedException("Cliente OAuth publicado incompatível.");
    const name = typeof metadata.client_name === "string" && metadata.client_name.trim() ? metadata.client_name.trim().slice(0, 120) : "Cliente MCP";
    await this.db.$executeRaw`insert into public.ia_oauth_client(client_id,client_name,redirect_uris)
      values(${clientId},${name},${JSON.stringify(uris)}::jsonb)
      on conflict (client_id) do update set client_name=excluded.client_name,redirect_uris=excluded.redirect_uris`;
    return { client_name: name, redirect_uris: uris };
  }
  private safeRedirect(uri: string) {
    try {
      const u = new URL(uri);
      return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname));
    } catch { return false; }
  }
  private verifyPkce(verifier: string, challenge: string) {
    return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && b64(createHash("sha256").update(verifier).digest()) === challenge;
  }
}

