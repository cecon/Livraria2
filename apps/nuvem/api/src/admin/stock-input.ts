import { BadRequestException } from "@nestjs/common";
import { uuid } from "../sync/validation";
import { objectInput, textInput } from "./reference-input";

export type StockMovementInput = {
  syncUid: string;
  bookUid: string;
  quantity: bigint;
  reason: string | null;
};

function quantity(value: unknown) {
  if (!Number.isSafeInteger(value) || value === 0) {
    throw new BadRequestException("Quantidade invalida");
  }
  return BigInt(value as number);
}

export function adjustmentInput(value: unknown): StockMovementInput {
  const input = objectInput(value);
  return {
    syncUid: uuid(input.sync_uid),
    bookUid: uuid(input.livro_uid),
    quantity: quantity(input.qtd),
    reason: textInput(input.motivo, 500, true),
  };
}

export function countInput(value: unknown): StockMovementInput[] {
  const items = objectInput(value).itens;
  if (!Array.isArray(items) || items.length > 500) throw new BadRequestException("Contagem invalida");
  const parsed = items.map(item => {
    const input = objectInput(item);
    return {
      syncUid: uuid(input.sync_uid),
      bookUid: uuid(input.livro_uid),
      quantity: quantity(input.qtd),
      reason: null,
    };
  });
  if (new Set(parsed.map(item => item.syncUid)).size !== parsed.length) {
    throw new BadRequestException("Movimento duplicado");
  }
  return parsed;
}

export function divergenceStatus(value: unknown): "resolvida" | "ignorada" {
  const status = objectInput(value).status;
  if (status !== "resolvida" && status !== "ignorada") {
    throw new BadRequestException("Status invalido");
  }
  return status;
}
