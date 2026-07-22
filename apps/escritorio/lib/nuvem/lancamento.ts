// Camada de dados de lançamento de entrada (US2/T027). Escrita multi-parte,
// pai-antes-de-filho por sync_uid: lancamento_entrada → item_lancamento →
// movimento_estoque(entrada). Eventos crus (origem='escritorio').
import { createClient } from "@/utils/supabase/client";

export type LivroRef = { sync_uid: string; codigo: string; titulo: string };
export type FornecedorRef = { sync_uid: string; nome: string };

export async function refsParaEntrada(): Promise<{ livros: LivroRef[]; fornecedores: FornecedorRef[] }> {
  const sb = createClient();
  const [l, f] = await Promise.all([
    sb.from("livro").select("sync_uid,codigo,titulo").is("excluido_em", null).order("titulo"),
    sb.from("fornecedor").select("sync_uid,nome").is("excluido_em", null).order("nome"),
  ]);
  return { livros: (l.data as LivroRef[]) ?? [], fornecedores: (f.data as FornecedorRef[]) ?? [] };
}

export type EntradaNota = { livroUid: string; fornecedorUid: string | null; qtd: number; custoCentavos: number };

export async function registrarEntrada(e: EntradaNota): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const criadoPor = sessao.user?.id ?? null;
  const agora = new Date().toISOString();
  const lancUid = crypto.randomUUID();

  const lanc = {
    sync_uid: lancUid,
    fornecedor_uid: e.fornecedorUid,
    numero: null,
    data: agora,
    status: "finalizada",
    finalizada_em: agora,
    origem: "escritorio",
    criado_por: criadoPor,
    atualizado_em: agora,
  };
  const item = {
    sync_uid: crypto.randomUUID(),
    lancamento_uid: lancUid,
    livro_uid: e.livroUid,
    qtd: e.qtd,
    custo_unit_centavos: e.custoCentavos,
    origem: "escritorio",
    criado_por: criadoPor,
  };
  const mov = {
    sync_uid: crypto.randomUUID(),
    livro_uid: e.livroUid,
    tipo: "entrada",
    qtd: e.qtd,
    custo_unit_centavos: e.custoCentavos,
    criado_em: agora,
    origem: "escritorio",
    criado_por: criadoPor,
  };

  const r1 = await sb.from("lancamento_entrada").insert(lanc);
  const r2 = r1.error ? r1 : await sb.from("item_lancamento").insert(item);
  const r3 = r2.error ? r2 : await sb.from("movimento_estoque").insert(mov);
  const err = r1.error || r2.error || r3.error;
  if (err) return { error: err.message };
  return {};
}
