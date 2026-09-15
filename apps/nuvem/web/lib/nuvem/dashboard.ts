import { reportsRequest } from "@/lib/api/relatorios-client";

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

export async function dashboard(p: PeriodoDash): Promise<DashboardDia> {
  return reportsRequest("dashboard", { periodo: p });
}
