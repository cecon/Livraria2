import { BadRequestException } from "@nestjs/common";

export type Provider = "openai-compatible" | "google";
export interface ConfigInput {
  nome: string; provedor: Provider; endereco: string; modelo: string;
  credencial?: string; ativo: boolean; pdv: boolean; retaguarda: boolean;
}

export function endpoint(value: unknown, provider: Provider): string {
  if (typeof value !== "string" || value.length > 500) throw new BadRequestException("Endereço inválido");
  let url: URL;
  try { url = new URL(value); } catch { throw new BadRequestException("Endereço inválido"); }
  if (url.username || url.password || url.search || url.hash || !["http:", "https:"].includes(url.protocol)) {
    throw new BadRequestException("Informe um endereço sem credenciais ou parâmetros");
  }
  const normalized = url.href.replace(/\/+$/, "");
  const official = provider === "google" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1";
  const extras = (process.env.LLM_ALLOWED_BASE_URLS ?? "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
  if (normalized !== official && (provider === "google" || !extras.includes(normalized))) {
    throw new BadRequestException("Endereço não autorizado no servidor para este provedor");
  }
  return normalized;
}

export function input(value: unknown): ConfigInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Configuração inválida");
  const body = value as Record<string, unknown>;
  const text = (name: string, max: number) => {
    const value = body[name];
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) {
      throw new BadRequestException(`Confira ${name}`);
    }
    return value.trim();
  };
  if (body.provedor !== "openai-compatible" && body.provedor !== "google") throw new BadRequestException("Provedor inválido");
  for (const name of ["ativo", "pdv", "retaguarda"]) {
    if (typeof body[name] !== "boolean") throw new BadRequestException(`Confira ${name}`);
  }
  if (!body.pdv && !body.retaguarda) throw new BadRequestException("Selecione onde usar esta configuração");
  let credencial: string | undefined;
  if (body.credencial !== undefined && body.credencial !== "") credencial = text("credencial", 4096);
  return { nome: text("nome", 100), provedor: body.provedor,
    endereco: endpoint(body.endereco, body.provedor), modelo: text("modelo", 200), credencial,
    ativo: body.ativo as boolean, pdv: body.pdv as boolean, retaguarda: body.retaguarda as boolean };
}
