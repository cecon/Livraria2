import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const logger = new Logger("HttpRequest");
const reasons = new Set([
  "Cursor nao confirmado", "Cursor nao entregue", "Dispositivo indisponivel",
  "Turno ja recebido com outros dados", "Usuario do turno indisponivel na nuvem",
  "Ja existe turno aberto nesta maquina", "Fechamento divergente",
  "Movimento ja recebido com outros dados", "Turno ou usuario nao pertencem a esta maquina",
  "Pedido ja recebido com outra identidade ou conteudo", "Pedido legado exige reconciliacao antes da migracao",
  "Venda do PDV exige turno e operador", "Turno ou operador nao pertencem a esta maquina",
  "Venda pertence a outro PDV", "Identidade duplicada ou cadastro dependente ainda indisponivel",
]);

export function safeReason(message: unknown, status: number): string {
  return typeof message === "string" && reasons.has(message) ? message :
    status >= 500 ? "Falha interna da API" : "Operacao recusada pela API";
}

export function safeSync(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, string> = {};
  for (const key of ["solicitado", "aplicado", "entregue"]) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string" && /^\d{1,19}$/.test(field)) result[key] = field;
  }
  return Object.keys(result).length ? result : undefined;
}

export function requestDiagnostics(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  const id = incoming && uuid.test(incoming) ? incoming : randomUUID();
  const started = performance.now();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  res.once("finish", () => {
    const principal = (req as Request & { principal?: { pdvUid?: string } }).principal;
    // Never log URL/query, headers, payload, token, customer or exception stack.
    const record = JSON.stringify({ event: "http_request", requestId: id,
      method: req.method, route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
      status: res.statusCode, durationMs: Math.round(performance.now() - started),
      pdvUid: principal?.pdvUid && uuid.test(principal.pdvUid) ? principal.pdvUid : undefined,
      reason: res.locals.reason, sync: res.locals.sync });
    if (res.statusCode >= 400) logger.warn(record); else logger.log(record);
  });
  next();
}

@Catch()
export class HttpErrorLogFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const original = exception instanceof HttpException ? exception.getResponse() : {};
    const body = typeof original === "object" && original !== null ? original as Record<string, unknown> : {};
    const reason = safeReason(body.message ?? original, status);
    const sync = safeSync(body.sync);
    res.locals.reason = reason;
    res.locals.sync = sync;
    res.status(status).json({ ...(status < 500 ? body : {}), statusCode: status,
      message: status === 409 || status >= 500 ? reason : body.message ?? reason,
      requestId: res.locals.requestId, ...(sync ? { sync } : {}) });
  }
}
