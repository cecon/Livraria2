"use client";

import { dominio } from "@/lib/dominio";
import { listarFormas } from "@/lib/nuvem/forma";
import { salesRequest } from "@/lib/api/vendas-client";

export type ItemVenda = {
  livroUid: string;
  codigo: string;
  titulo: string;
  precoCentavos: number;
  qtd: number;
};

export type RecebimentoVenda = { formaUid: string; valorCentavos: number };

export type VendaInput = {
  turnoUid: string;
  cliente?: string;
  itens: ItemVenda[];
  pagamentos: RecebimentoVenda[];
};

export type VendaResultado = {
  numeroNoTurno: number;
  totalCentavos: number;
  trocoCentavos: number;
  divergenciasEstoque: number;
};

export async function registrarVenda(input: VendaInput): Promise<{ error?: string; resultado?: VendaResultado }> {
  const dom = await dominio();

  if (input.itens.length === 0) return { error: "Adicione ao menos um item." };

  const formas = await listarFormas();
  const idPorUid = new Map<string, number>();
  let dinheiroId = -1;
  formas.forEach((f, i) => {
    idPorUid.set(f.sync_uid, i + 1);
    if (f.chave === "dinheiro") dinheiroId = i + 1;
  });

  const itensWasm = input.itens.map((i) => ({ precoCentavos: i.precoCentavos, qtd: i.qtd }));
  const pagsWasm = input.pagamentos
    .filter((p) => p.valorCentavos > 0)
    .map((p) => ({ formaId: idPorUid.get(p.formaUid) ?? 0, valorCentavos: p.valorCentavos }));

  const val = dom.validar_conclusao_venda(itensWasm, pagsWasm, dinheiroId) as {
    ok: boolean;
    erro?: string;
    faltaCentavos?: number;
  };
  if (!val.ok) return { error: mensagemErro(val) };

  try {
    const resultado = await salesRequest("", "POST", {
      pedidoUid: crypto.randomUUID(), turnoUid: input.turnoUid,
      cliente: (input.cliente ?? "").trim() || "CLIENTE",
      itens: input.itens.map(item => ({ uid: crypto.randomUUID(), livroUid: item.livroUid,
        codigo: item.codigo, titulo: item.titulo, precoCentavos: item.precoCentavos,
        quantidade: item.qtd })),
      pagamentos: input.pagamentos.filter(payment => payment.valorCentavos > 0)
        .map(payment => ({ uid: crypto.randomUUID(), formaUid: payment.formaUid,
          valorCentavos: payment.valorCentavos })),
    }) as VendaResultado;
    return { resultado };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao registrar venda" };
  }
}

function mensagemErro(v: { erro?: string; faltaCentavos?: number }): string {
  switch (v.erro) {
    case "SEM_ITENS":
      return "Adicione ao menos um item.";
    case "PAGO_INSUFICIENTE":
      return "Pagamento insuficiente para concluir a venda.";
    case "TROCO_SEM_DINHEIRO":
      return "O troco so pode sair do Dinheiro.";
    default:
      return "Nao foi possivel concluir a venda.";
  }
}

export type VendaResumo = {
  sync_uid: string;
  numeroNoTurno: number | null;
  numero: number;
  cliente: string;
  totalCentavos: number;
  cancelado: boolean;
};

export async function listarVendasDoDia(): Promise<VendaResumo[]> {
  return salesRequest("/hoje");
}
