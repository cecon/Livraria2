import { BadRequestException } from "@nestjs/common";

export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException();
  return value as Record<string, unknown>;
}

export function textInput(value: unknown, max: number, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new BadRequestException("Texto invalido");
  }
  return value.trim() || null;
}

export function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function booleanInput(value: unknown) {
  if (typeof value !== "boolean") throw new BadRequestException("Valor booleano invalido");
  return value;
}

export function orderInput(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 2147483647) {
    throw new BadRequestException("Ordem invalida");
  }
  return value as number;
}
