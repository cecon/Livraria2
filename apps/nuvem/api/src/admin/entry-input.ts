import { BadRequestException } from "@nestjs/common";
import { uuid } from "../sync/validation";
import { objectInput, textInput } from "./reference-input";

export function entryHeader(value: unknown) {
  const input = objectInput(value);
  return {
    supplierUid: input.fornecedor_uid == null ? null : uuid(input.fornecedor_uid),
    number: textInput(input.numero, 500),
  };
}

export function entryItem(value: unknown) {
  const input = objectInput(value);
  if (!Number.isSafeInteger(input.qtd) || (input.qtd as number) <= 0) {
    throw new BadRequestException("Quantidade invalida");
  }
  if (!Number.isSafeInteger(input.custo_unit_centavos) || (input.custo_unit_centavos as number) <= 0) {
    throw new BadRequestException("Custo invalido");
  }
  return {
    syncUid: uuid(input.sync_uid),
    bookUid: uuid(input.livro_uid),
    quantity: BigInt(input.qtd as number),
    unitCost: BigInt(input.custo_unit_centavos as number),
  };
}
