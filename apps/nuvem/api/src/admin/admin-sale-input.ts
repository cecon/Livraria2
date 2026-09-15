import { BadRequestException } from "@nestjs/common";
import { uuid } from "../sync/validation";
import { objectInput, textInput } from "./reference-input";

function positive(value: unknown, zero = false) {
  if (!Number.isSafeInteger(value) || (zero ? (value as number) < 0 : (value as number) <= 0)) {
    throw new BadRequestException("Inteiro invalido");
  }
  return value as number;
}
function list(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new BadRequestException("Lista invalida");
  return value;
}

export function adminSaleInput(value: unknown) {
  const input = objectInput(value);
  const items = list(input.itens).map(value => {
    const item = objectInput(value);
    return { uid: uuid(item.uid), bookUid: uuid(item.livroUid), codigo: textInput(item.codigo, 100, true)!,
      titulo: textInput(item.titulo, 500, true)!, price: positive(item.precoCentavos, true),
      quantity: positive(item.quantidade) };
  });
  const payments = list(input.pagamentos).map(value => {
    const payment = objectInput(value);
    return { uid: uuid(payment.uid), formUid: uuid(payment.formaUid), value: positive(payment.valorCentavos) };
  });
  const ids = [...items.map(item => item.uid), ...payments.map(payment => payment.uid)];
  if (new Set(ids).size !== ids.length || new Set(payments.map(p => p.formUid)).size !== payments.length) {
    throw new BadRequestException("Identidade duplicada");
  }
  const total = items.reduce((sum, item) => sum + BigInt(item.price) * BigInt(item.quantity), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new BadRequestException("Total invalido");
  return { pedidoUid: uuid(input.pedidoUid), shiftUid: uuid(input.turnoUid),
    cliente: textInput(input.cliente, 500) ?? "CLIENTE", items, payments, total };
}
