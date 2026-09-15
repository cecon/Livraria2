import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { uuid } from "../sync/validation";
import { cents, closingInput } from "./shift-input";

function integer(value: bigint | null, label: string): number | null {
  if (value === null) return null;
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async current(actor: string) {
    const row = await this.db.turno_operacao.findFirst({ where: { operador_uid: actor,
      status: "aberto", excluido_em: null }, orderBy: { abertura: "desc" } });
    return row ? { sync_uid: row.sync_uid,
      caixaInicialCentavos: integer(row.caixa_inicial_centavos, "Caixa inicial"), abertura: row.abertura } : null;
  }

  async create(id: string, value: unknown, actor: string) {
    const syncUid = uuid(id);
    const initial = cents((value as Record<string, unknown>)?.caixa_inicial_centavos ?? 0);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`lock table public.turno_operacao in share row exclusive mode`;
      const open = await tx.turno_operacao.findFirst({ where: {
        operador_uid: actor, status: "aberto", excluido_em: null } });
      if (open) throw new ConflictException("Ja existe turno aberto");
      const now = new Date();
      await tx.turno_operacao.create({ data: { sync_uid: syncUid, operador_uid: actor,
        caixa_inicial_centavos: initial, status: "aberto", abertura: now.toISOString(),
        origem: "escritorio", criado_por: actor, atualizado_em: now, sincronizado_em: now } });
      return { sync_uid: syncUid, operadorUid: actor,
        caixaInicialCentavos: integer(initial, "Caixa inicial"), abertura: now.toISOString() };
    });
  }

  async history(actor: string) {
    const rows = await this.db.turno_operacao.findMany({ where: {
      operador_uid: actor, excluido_em: null }, orderBy: { abertura: "desc" }, take: 50 });
    return rows.map(row => ({ sync_uid: row.sync_uid, abertura: row.abertura,
      encerramento: row.encerramento, status: row.status,
      esperadoCentavos: integer(row.esperado_centavos, "Esperado"),
      conferidoCentavos: integer(row.conferido_centavos, "Conferido"),
      diferencaCentavos: integer(row.diferenca_centavos, "Diferenca") }));
  }

  async orderCount(id: string, actor: string) {
    const shiftUid = uuid(id);
    await this.owned(shiftUid, actor);
    return this.db.pedido.count({ where: { turno_uid: shiftUid, cancelado: false, excluido_em: null } });
  }

  async summary(id: string, actor: string) {
    const shiftUid = uuid(id);
    const shift = await this.owned(shiftUid, actor);
    const rows = await this.db.$queryRaw<{ rotulo: string; chave: string; centavos: bigint }[]>`
      select f.rotulo, f.chave, coalesce(sum(pg.valor_centavos),0)::bigint as centavos
      from public.pedido p join public.pagamento_pedido pg on pg.pedido_uid=p.sync_uid
      join public.forma_pagamento f on f.sync_uid=pg.forma_uid
      where p.turno_uid=${shiftUid}::uuid and not p.cancelado and p.excluido_em is null
        and pg.excluido_em is null and f.excluido_em is null
      group by f.sync_uid, f.rotulo, f.chave order by f.ordem, f.rotulo`;
    const count = await this.db.pedido.count({ where: { turno_uid: shiftUid,
      cancelado: false, excluido_em: null } });
    const cash = rows.find(row => row.chave === "dinheiro")?.centavos ?? 0n;
    const expected = shift.caixa_inicial_centavos + cash;
    return { qtdVendas: count, porForma: rows.map(row => ({ rotulo: row.rotulo,
      centavos: integer(row.centavos, "Recebimento") })),
      esperadoDinheiroCentavos: integer(expected, "Dinheiro esperado") };
  }

  async close(id: string, value: unknown, actor: string) {
    const shiftUid = uuid(id);
    const checked = closingInput(value);
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ status: string; operador_uid: string | null;
        caixa_inicial_centavos: bigint; conferido_centavos: bigint | null;
        diferenca_centavos: bigint | null; excluido_em: Date | null }[]>`
        select status, operador_uid::text, caixa_inicial_centavos, conferido_centavos,
          diferenca_centavos, excluido_em from public.turno_operacao
        where sync_uid=${shiftUid}::uuid for update`;
      const shift = rows[0];
      if (!shift || shift.excluido_em || shift.operador_uid !== actor) throw new NotFoundException();
      if (shift.status === "encerrado") {
        if (shift.conferido_centavos !== checked) throw new ConflictException("Turno ja encerrado");
        return { diferencaCentavos: integer(shift.diferenca_centavos, "Diferenca") };
      }
      const payments = await tx.$queryRaw<{ total: bigint }[]>`
        select coalesce(sum(pg.valor_centavos),0)::bigint as total
        from public.pedido p join public.pagamento_pedido pg on pg.pedido_uid=p.sync_uid
        join public.forma_pagamento f on f.sync_uid=pg.forma_uid
        where p.turno_uid=${shiftUid}::uuid and not p.cancelado and p.excluido_em is null
          and pg.excluido_em is null and f.chave='dinheiro' and f.excluido_em is null`;
      const expected = shift.caixa_inicial_centavos + payments[0].total;
      const difference = checked - expected;
      const now = new Date();
      await tx.turno_operacao.update({ where: { sync_uid: shiftUid }, data: { status: "encerrado",
        encerramento: now.toISOString(), esperado_centavos: expected, conferido_centavos: checked,
        diferenca_centavos: difference, atualizado_em: now, sincronizado_em: now } });
      return { diferencaCentavos: integer(difference, "Diferenca") };
    });
  }

  private async owned(id: string, actor: string) {
    const shift = await this.db.turno_operacao.findFirst({ where: {
      sync_uid: id, operador_uid: actor, excluido_em: null } });
    if (!shift) throw new NotFoundException("Turno nao encontrado");
    return shift;
  }
}
