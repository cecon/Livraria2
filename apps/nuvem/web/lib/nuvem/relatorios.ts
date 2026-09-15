import { reportsRequest } from "@/lib/api/relatorios-client";
import type { ItemRelatorioEstoque } from "./relatorios_estoque";

export { montarItensRelatorioEstoque } from "./relatorios_estoque";

export type LinhaValor = { rotulo: string; valorCentavos: number };
export type ItemRel = { titulo: string; qtd: number; valorCentavos: number };
export type PedidoRel = {
  numero: number;
  cliente: string;
  cancelado: boolean;
  totalCentavos: number;
  itens: ItemRel[];
  recebimentos: LinhaValor[];
};
export type RepasseRel = { nome: string; qtd: number; valorCentavos: number; livros: ItemRel[] };
export type RelatorioVendas = {
  data: string;
  periodo: string;
  pedidos: PedidoRel[];
  repasses: RepasseRel[];
  resumo: { formas: LinhaValor[]; subtotalCentavos: number };
};
export type RelatorioEstoque = {
  titulos: number;
  valorTotalCentavos: number;
  itens: ItemRelatorioEstoque[];
};
export type RelatorioDestinacoes = {
  inicio: string;
  fim: string;
  linhas: { nome: string; qtd: number; valorCentavos: number }[];
  totalCentavos: number;
};

export function relatorioEstoque(): Promise<RelatorioEstoque> {
  return reportsRequest("estoque");
}

export function relatorioDestinacoes(inicio: string, fim: string): Promise<RelatorioDestinacoes> {
  return reportsRequest("destinacoes", { inicio, fim });
}

export function relatorioVendas(data: string, periodo: string): Promise<RelatorioVendas> {
  return reportsRequest("vendas", { data, periodo });
}
