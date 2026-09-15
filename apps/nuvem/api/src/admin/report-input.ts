import { BadRequestException } from "@nestjs/common";

export function dateInput(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new BadRequestException("Data invalida");
  return value;
}
export function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function salesPeriod(value: unknown) {
  if (value !== "dia" && value !== "manha" && value !== "tarde") {
    throw new BadRequestException("Periodo invalido");
  }
  return value;
}
export function dashboardPeriod(value: unknown) {
  if (value !== "hoje" && value !== "7dias" && value !== "mes" && value !== "ano") {
    throw new BadRequestException("Periodo invalido");
  }
  return value;
}
