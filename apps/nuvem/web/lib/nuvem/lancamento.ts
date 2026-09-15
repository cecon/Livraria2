import { entriesRequest } from "@/lib/api/lancamentos-client";

export type StatusNota = "rascunho" | "finalizada" | "cancelada";
export type NotaResumo = {
  sync_uid: string;
  fornecedorNome: string | null;
  data: string;
  status: StatusNota;
  qtdItens: number;
  totalCentavos: number;
};
export type ItemNota = {
  sync_uid: string;
  titulo: string;
  qtd: number;
  custoUnitCentavos: number;
  subtotalCentavos: number;
};
export type NotaDetalhe = {
  sync_uid: string;
  numero: string | null;
  status: StatusNota;
  fornecedorUid: string | null;
  fornecedorNome: string | null;
  itens: ItemNota[];
  totalCentavos: number;
};

export function lancamentosListar(): Promise<NotaResumo[]> {
  return entriesRequest("");
}

export async function lancamentoCriar(): Promise<string> {
  const uid = crypto.randomUUID();
  await entriesRequest("", "POST", { sync_uid: uid });
  return uid;
}

export function lancamentoObter(uid: string): Promise<NotaDetalhe | null> {
  return entriesRequest(`/${uid}`);
}

export async function lancamentoDefinirFornecedor(
  uid: string,
  fornecedorUid: string | null,
  numero?: string | null,
): Promise<void> {
  await entriesRequest(`/${uid}`, "PUT", {
    fornecedor_uid: fornecedorUid,
    numero: numero ?? null,
  });
}

export async function lancamentoAdicionarItem(
  uid: string,
  livroUid: string,
  qtd: number,
  custoUnitCentavos: number,
): Promise<void> {
  await entriesRequest(`/${uid}/itens`, "POST", {
    sync_uid: crypto.randomUUID(),
    livro_uid: livroUid,
    qtd,
    custo_unit_centavos: custoUnitCentavos,
  });
}

export async function lancamentoRemoverItem(itemUid: string, lancamentoUid?: string): Promise<void> {
  if (!lancamentoUid) throw new Error("Lancamento nao informado");
  await entriesRequest(`/${lancamentoUid}/itens/${itemUid}`, "DELETE");
}

async function executarAcao(uid: string, acao: "finalizacao" | "cancelamento") {
  try {
    await entriesRequest(`/${uid}/${acao}`, "POST", {});
    return {};
  } catch (error) {
    const verbo = acao === "finalizacao" ? "finalizar" : "cancelar";
    return { error: error instanceof Error ? error.message : `Falha ao ${verbo} lancamento` };
  }
}

export function lancamentoFinalizar(uid: string): Promise<{ error?: string }> {
  return executarAcao(uid, "finalizacao");
}

export function lancamentoCancelar(uid: string): Promise<{ error?: string }> {
  return executarAcao(uid, "cancelamento");
}

export async function lancamentoExcluir(uid: string): Promise<void> {
  await entriesRequest(`/${uid}`, "DELETE");
}
