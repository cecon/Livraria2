import { BadRequestException } from "@nestjs/common";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Dados inválidos");
  }
  return value as Record<string, unknown>;
}
