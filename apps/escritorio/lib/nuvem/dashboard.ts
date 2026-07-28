// Dashboard do Início (US2) — agrega vendas/itens/estoque/canceladas por período.
import { createClient } from "@/utils/supabase/client";

export type PeriodoDash = "hoje" | "7dias" | "mes" | "ano";

export type LivroBaixo = { codigo: string; titulo: string; autor: string | null; estoque: number };
export type DashboardDia = {
  vendasCentavos: number;
  itensVendidos: number;
  ticketMedioCentavos: number;
  totalLivros: number;
  totalEstoque: number;
  canceladasQtd: number;
  canceladasCentavos: number;
  estoqueBaixo: LivroBaixo[];
};

function inicioPeriodo(p: PeriodoDash): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "7dias") d.setDate(d.getDate() - 6);
  else if (p === "mes") d.setDate(1);
  else if (p === "ano") {
    d.setMonth(0);
    d.setDate(1);
  }
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return iso;
}

export async function dashboard(p: PeriodoDash): Promise<DashboardDia> {
  const sb = createClient();
  const desde = inicioPeriodo(p);

  const [pedRes, itRes, saldoRes] = await Promise.all([
    sb.from("pedido").select("total_centavos,cancelado").is("excluido_em", null).gte("data", desde),
    sb.from("item_pedido").select("qtd,pedido!inner(data,cancelado)").gte("pedido.data", desde).eq("pedido.cancelado", false),
    sb.from("vw_saldo_livro").select("livro_uid,codigo,saldo"),
  ]);

  const pedidos = (pedRes.data as { total_centavos: number; cancelado: boolean }[]) ?? [];
  const validos = pedidos.filter((x) => !x.cancelado);
  const canceladas = pedidos.filter((x) => x.cancelado);
  const vendasCentavos = validos.reduce((s, x) => s + Number(x.total_centavos), 0);
  const itensVendidos = ((itRes.data as { qtd: number }[]) ?? []).reduce((s, i) => s + Number(i.qtd), 0);

  const saldos = (saldoRes.data as { livro_uid: string; codigo: string; saldo: number }[]) ?? [];
  const totalEstoque = saldos.reduce((s, r) => s + Number(r.saldo), 0);

  // Estoque baixo (≤3): resolve título/autor dos primeiros.
  const baixos = saldos.filter((r) => Number(r.saldo) <= 3).sort((a, b) => Number(a.saldo) - Number(b.saldo));
  const uids = baixos.slice(0, 8).map((r) => r.livro_uid);
  let estoqueBaixo: LivroBaixo[] = [];
  if (uids.length) {
    const { data: livros } = await sb.from("livro").select("sync_uid,codigo,titulo,autor").in("sync_uid", uids);
    const mapa = new Map((livros as { sync_uid: string; titulo: string; autor: string | null }[] ?? []).map((l) => [l.sync_uid, l]));
    estoqueBaixo = baixos.slice(0, 8).map((r) => ({
      codigo: r.codigo,
      titulo: mapa.get(r.livro_uid)?.titulo ?? r.codigo,
      autor: mapa.get(r.livro_uid)?.autor ?? null,
      estoque: Number(r.saldo),
    }));
  }

  return {
    vendasCentavos,
    itensVendidos,
    ticketMedioCentavos: validos.length ? Math.round(vendasCentavos / validos.length) : 0,
    totalLivros: saldos.length,
    totalEstoque,
    canceladasQtd: canceladas.length,
    canceladasCentavos: canceladas.reduce((s, x) => s + Number(x.total_centavos), 0),
    estoqueBaixo,
  };
}
