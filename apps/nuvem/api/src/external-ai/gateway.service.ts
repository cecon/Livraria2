import { BadRequestException, ForbiddenException, GatewayTimeoutException, HttpException, Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { object } from "./validation";
import { IaAccess } from "./access.service";
import { IaCatalog } from "./catalog.service";

@Injectable()
export class IaGateway {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(IaCatalog) private readonly catalog: IaCatalog) {}
  async execute(value: unknown, access: IaAccess) {
    const v = object(value), method = String(v.metodo), path = String(v.rota);
    if (!/^\/[A-Za-z0-9/._-]+$/.test(path) || path.includes("..") || path.includes("//") || path.length > 300) throw new BadRequestException("Rota inválida.");
    const operation = this.catalog.find(method, path, access);
    if (!operation) throw new ForbiddenException("Operação não disponível neste acesso. Consulte /api/ia/catalogo.");
    const query = new URLSearchParams();
    if (v.consulta !== undefined) for (const [key, val] of Object.entries(object(v.consulta))) {
      if (!operation.consulta.includes(key) || typeof val !== "string" || val.length > 500) throw new BadRequestException("Parâmetro de consulta inválido.");
      query.set(key, val);
    }
    const body = ["GET", "DELETE"].includes(method) && !operation.corpo ? undefined : JSON.stringify(v.corpo ?? {});
    if (body && body.length > (path === "/agentes/cadastro/fotos" ? 2100000 : 90000)) throw new BadRequestException("Corpo excessivo.");
    const uid = randomUUID();
    await this.db.$executeRaw`insert into public.ia_requisicao(uid,acesso_uid,usuario_uid,metodo,rota)
      values(${uid}::uuid,${access.uid}::uuid,${access.usuario_uid}::uuid,${method},${path})`;
    let status = 502;
    try {
      const ttl = Math.min(60, Math.floor((access.expira_em.getTime() - Date.now()) / 1000));
      if (ttl <= 0) throw new ForbiddenException("Acesso expirado.");
      const token = await this.jwt.signAsync({ sub: access.usuario_uid, tipo: "usuario" }, { expiresIn: ttl });
      // Fixed loopback destination. The temporary token never authenticates directly on business routes.
      const response = await fetch(`http://127.0.0.1:${Number(process.env.PORT || 3001)}/api/v1${path}${query.size ? "?" + query : ""}`, {
        method, redirect: "error", signal: AbortSignal.timeout(55000),
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body && { body }),
      });
      const reader = response.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
      if (reader) try {
        while (true) {
          const { done, value: chunk } = await reader.read(); if (done) break;
          size += chunk.length; if (size > 20000000) throw new Error("Resposta excessiva"); chunks.push(chunk);
        }
      } finally { await reader.cancel(); }
      status = response.status;
      return { status, bytes: Buffer.concat(chunks), type: response.headers.get("content-type") || "application/json",
        disposition: response.headers.get("content-disposition") };
    } catch (error) {
      if (error instanceof HttpException) { status = error.getStatus(); throw error; }
      status = 504;
      throw new GatewayTimeoutException("Não foi possível confirmar o resultado. Consulte o registro antes de repetir uma alteração.");
    } finally {
      await this.db.$executeRaw`update public.ia_requisicao set status=${status},concluido_em=now() where uid=${uid}::uuid`;
      await this.db.$executeRaw`update public.ia_acesso set ultimo_uso_em=now() where uid=${access.uid}::uuid`;
    }
  }
}

