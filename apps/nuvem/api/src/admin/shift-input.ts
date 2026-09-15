import { BadRequestException } from "@nestjs/common";
import { objectInput } from "./reference-input";

export function cents(value: unknown, allowNegative = false) {
  if (!Number.isSafeInteger(value) || (!allowNegative && (value as number) < 0)) {
    throw new BadRequestException("Valor em centavos invalido");
  }
  return BigInt(value as number);
}

export function closingInput(value: unknown) {
  return cents(objectInput(value).conferido_centavos);
}
