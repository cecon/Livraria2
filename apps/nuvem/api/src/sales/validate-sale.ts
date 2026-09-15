import { BadRequestException } from "@nestjs/common";
import { SaleV1 } from "./sale.contract";
import { uuid } from "../sync/validation";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Objeto invalido");
  return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
    throw new BadRequestException("Inteiro invalido");
  }
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new BadRequestException("Texto invalido");
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new BadRequestException("Lista invalida");
  return value;
}

export function validateSale(value: unknown): SaleV1 {
  const body = object(value);
  if (typeof body.cancelado !== "boolean") throw new BadRequestException("Cancelado invalido");
  const itens = list(body.itens).map(value => {
    const i = object(value);
    return {
      uid: uuid(i.uid), livroUid: uuid(i.livroUid), codigo: text(i.codigo, 100),
      titulo: text(i.titulo, 500), precoCentavos: integer(i.precoCentavos),
      quantidade: integer(i.quantidade, 1),
    };
  }).sort((a, b) => a.uid.localeCompare(b.uid));
  const pagamentos = list(body.pagamentos).map(value => {
    const p = object(value);
    return { uid: uuid(p.uid), formaUid: uuid(p.formaUid), valorCentavos: integer(p.valorCentavos) };
  }).sort((a, b) => a.uid.localeCompare(b.uid));
  const ids = [...itens.map(i => i.uid), ...pagamentos.map(p => p.uid)];
  if (new Set(ids).size !== ids.length || new Set(pagamentos.map(p => p.formaUid)).size !== pagamentos.length) {
    throw new BadRequestException("Identidade duplicada");
  }
  const total = integer(body.totalCentavos);
  const itemTotal = itens.reduce((sum, i) => sum + BigInt(i.precoCentavos) * BigInt(i.quantidade), 0n);
  const paid = pagamentos.reduce((sum, p) => sum + BigInt(p.valorCentavos), 0n);
  if (itemTotal !== BigInt(total) || paid !== BigInt(total)) {
    throw new BadRequestException("Total de itens e pagamentos nao confere");
  }
  return {
    pedidoUid: uuid(body.pedidoUid), numero: integer(body.numero, 1),
    cliente: text(body.cliente, 500), turno: text(body.turno, 100), data: text(body.data, 100),
    totalCentavos: total, cancelado: body.cancelado,
    operadorUid: body.operadorUid == null ? null : uuid(body.operadorUid),
    turnoUid: body.turnoUid == null ? null : uuid(body.turnoUid),
    numeroNoTurno: body.numeroNoTurno == null ? null : integer(body.numeroNoTurno, 1),
    itens, pagamentos,
  };
}
