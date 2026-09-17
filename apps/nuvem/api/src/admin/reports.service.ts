import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { dashboardPeriod, dateInput, nextDate, salesPeriod } from "./report-input";

function integer(value: bigint, label: string) {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictException(`${label} fora do contrato; reconciliacao necessaria`);
  }
  return Number(value);
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async stock() {
    const rows = await this.db.$queryRaw<{ codigo: string; titulo: string; categoria: number;
      preco: bigint; saldo: bigint }[]>`
      select l.codigo, l.titulo, l.categoria, l.preco_centavos as preco,
        coalesce(sum(m.qtd) filter (where m.excluido_em is null),0)::bigint as saldo
      from public.livro l left join public.movimento_estoque m on m.livro_uid=l.sync_uid
      where l.excluido_em is null and l.ativo group by l.sync_uid order by l.titulo`;
    const items = rows.map(row => ({ codigo: row.codigo, titulo: row.titulo, categoria: row.categoria,
      precoCentavos: integer(row.preco, "Preco"), estoque: integer(row.saldo, "Saldo"),
      valorCentavos: integer(row.preco * row.saldo, "Valor do estoque") }));
    return { titulos: items.length,
      valorTotalCentavos: integer(rows.reduce((sum, row) => sum + row.preco * row.saldo, 0n), "Total do estoque"),
      itens: items };
  }

  async destinations(startValue: unknown, endValue: unknown) {
    const start = dateInput(startValue);
    const end = dateInput(endValue);
    if (end < start) throw new ConflictException("Periodo invertido");
    const rows = await this.db.alocacao_venda.findMany({ where: { excluido_em: null,
      pedido: { data: { gte: start, lt: nextDate(end) }, cancelado: false, excluido_em: null } },
      select: { qtd: true, valor_centavos: true, destinacao: { select: { nome: true } } } });
    const grouped = new Map<string, { quantity: bigint; value: bigint }>();
    for (const row of rows) {
      const current = grouped.get(row.destinacao.nome) ?? { quantity: 0n, value: 0n };
      grouped.set(row.destinacao.nome, { quantity: current.quantity + row.qtd,
        value: current.value + row.valor_centavos });
    }
    const lines = [...grouped].map(([nome, total]) => ({ nome,
      qtd: integer(total.quantity, "Quantidade"), valorCentavos: integer(total.value, "Valor") }))
      .sort((a, b) => b.valorCentavos - a.valorCentavos);
    return { inicio: start, fim: end, linhas: lines,
      totalCentavos: integer([...grouped.values()].reduce((sum, total) => sum + total.value, 0n), "Total") };
  }

  async sales(dateValue: unknown, periodValue: unknown) {
    const date = dateInput(dateValue);
    const period = salesPeriod(periodValue);
    const rows = await this.db.pedido.findMany({ where: { excluido_em: null,
      data: { gte: date, lt: nextDate(date) }, ...(period !== "dia" && { turno: period }) },
      orderBy: { numero: "asc" }, select: { numero: true, cliente: true, cancelado: true,
        total_centavos: true, item_pedido: { where: { excluido_em: null },
          select: { titulo: true, qtd: true, preco_centavos: true } },
        pagamento_pedido: { where: { excluido_em: null }, select: {
          valor_centavos: true, forma_pagamento: { select: { rotulo: true } } } } } });
    const forms = new Map<string, bigint>();
    const orders = rows.map(row => {
      const payments = row.pagamento_pedido.map(payment => {
        if (!row.cancelado) forms.set(payment.forma_pagamento.rotulo,
          (forms.get(payment.forma_pagamento.rotulo) ?? 0n) + payment.valor_centavos);
        return { rotulo: payment.forma_pagamento.rotulo,
          valorCentavos: integer(payment.valor_centavos, "Recebimento") };
      });
      return { numero: integer(row.numero, "Numero"), cliente: row.cliente, cancelado: row.cancelado,
        totalCentavos: integer(row.total_centavos, "Total"), recebimentos: payments,
        itens: row.item_pedido.map(item => ({ titulo: item.titulo, qtd: integer(item.qtd, "Quantidade"),
          valorCentavos: integer(item.qtd * item.preco_centavos, "Subtotal") })) };
    });
    const summary = [...forms].map(([rotulo, value]) => ({ rotulo, valorCentavos: integer(value, "Total por forma") }));
    return { data: date, periodo: period, pedidos: orders, repasses: [], resumo: {
      formas: summary, subtotalCentavos: integer([...forms.values()].reduce((sum, value) => sum + value, 0n), "Total") } };
  }

  async dashboard(value: unknown) {
    const period = dashboardPeriod(value);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "7dias") start.setDate(start.getDate() - 6);
    else if (period === "mes") start.setDate(1);
    else if (period === "ano") { start.setMonth(0); start.setDate(1); }
    const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const orders = await this.db.pedido.findMany({ where: { data: { gte: from }, excluido_em: null },
      select: { total_centavos: true, cancelado: true,
        item_pedido: { where: { excluido_em: null }, select: { qtd: true } } } });
    const valid = orders.filter(order => !order.cancelado);
    const canceled = orders.filter(order => order.cancelado);
    const sales = valid.reduce((sum, order) => sum + order.total_centavos, 0n);
    const itemCount = valid.reduce((sum, order) => sum +
      order.item_pedido.reduce((subtotal, item) => subtotal + item.qtd, 0n), 0n);
    const stocks = await this.db.$queryRaw<{ codigo: string; titulo: string; autor: string | null; saldo: bigint }[]>`
      select l.codigo,l.titulo,l.autor,coalesce(sum(m.qtd) filter(where m.excluido_em is null),0)::bigint saldo
      from public.livro l left join public.movimento_estoque m on m.livro_uid=l.sync_uid
      where l.excluido_em is null and l.ativo group by l.sync_uid order by saldo asc,l.titulo`;
    const totalStock = stocks.reduce((sum, row) => sum + row.saldo, 0n);
    return { vendasCentavos: integer(sales, "Vendas"), itensVendidos: integer(itemCount, "Itens"),
      ticketMedioCentavos: valid.length ? integer((sales + BigInt(Math.floor(valid.length / 2))) /
        BigInt(valid.length), "Ticket") : 0,
      totalLivros: stocks.length, totalEstoque: integer(totalStock, "Estoque"), canceladasQtd: canceled.length,
      canceladasCentavos: integer(canceled.reduce((sum, order) => sum + order.total_centavos, 0n), "Canceladas"),
      estoqueBaixo: stocks.filter(row => row.saldo <= 3n).slice(0, 8).map(row => ({ codigo: row.codigo,
        titulo: row.titulo, autor: row.autor, estoque: integer(row.saldo, "Saldo") })) };
  }
}
