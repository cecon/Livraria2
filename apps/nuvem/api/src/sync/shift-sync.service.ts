import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "./validation";

function fields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Turno invalido");
  return value as Record<string, unknown>;
}

function money(value: unknown): bigint {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new BadRequestException("Valor invalido");
  return BigInt(value as number);
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value) ||
    Number.isNaN(Date.parse(value))) throw new BadRequestException("Data invalida");
  return value;
}

@Injectable()
export class ShiftSyncService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async open(pdv: string, value: unknown) {
    const body = fields(value);
    const id = uuid(body.turnoUid);
    const operator = uuid(body.operadorUid);
    const initial = money(body.caixaInicialCentavos);
    const opened = timestamp(body.abertura);
    try {
      return await this.db.$transaction(async tx => {
        const existing = await tx.turno_operacao.findUnique({ where: { sync_uid: id } });
        if (existing) {
          if (existing.pdv_uid !== pdv || existing.operador_uid !== operator ||
            existing.caixa_inicial_centavos !== initial || existing.abertura !== opened) {
            throw new ConflictException("Turno ja recebido com outros dados");
          }
          return { turnoUid: id, recebido: true };
        }
        const user = await tx.usuario.findUnique({ where: { sync_uid: operator } });
        if (!user) throw new ConflictException("Usuario do turno indisponivel na nuvem");
        await tx.turno_operacao.create({ data: {
          sync_uid: id, pdv_uid: pdv, operador_uid: operator, caixa_inicial_centavos: initial,
          status: "aberto", abertura: opened, origem: "pdv", atualizado_em: new Date(),
        } });
        return { turnoUid: id, recebido: true };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ja existe turno aberto nesta maquina");
      }
      throw error;
    }
  }

  async close(pdv: string, id: string, value: unknown) {
    const body = fields(value);
    const expected = money(body.esperadoCentavos);
    const checked = money(body.conferidoCentavos);
    const difference = checked - expected;
    if (!Number.isSafeInteger(body.diferencaCentavos) ||
      BigInt(body.diferencaCentavos as number) !== difference) throw new BadRequestException("Diferenca invalida");
    const closed = timestamp(body.encerramento);
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ pdv_uid: string | null; status: string; esperado_centavos: bigint | null;
        conferido_centavos: bigint | null; diferenca_centavos: bigint | null }[]>`
        select pdv_uid::text, status, esperado_centavos, conferido_centavos, diferenca_centavos
        from public.turno_operacao where sync_uid=${id}::uuid for update`;
      const shift = rows[0];
      if (!shift || shift.pdv_uid !== pdv) throw new NotFoundException("Turno nao encontrado nesta maquina");
      if (shift.status === "encerrado") {
        if (shift.esperado_centavos !== expected || shift.conferido_centavos !== checked ||
          shift.diferenca_centavos !== difference) throw new ConflictException("Fechamento divergente");
        return { turnoUid: id, encerrado: true };
      }
      await tx.turno_operacao.update({ where: { sync_uid: id }, data: {
        status: "encerrado", encerramento: closed, esperado_centavos: expected,
        conferido_centavos: checked, diferenca_centavos: difference,
        atualizado_em: new Date(), sincronizado_em: new Date(),
      } });
      return { turnoUid: id, encerrado: true };
    });
  }
}
