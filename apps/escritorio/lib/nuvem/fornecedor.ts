// Camada de dados de fornecedores (US2/T028) — dedup por nome_norm; LWW.
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

export type Fornecedor = {
  sync_uid: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const sb = createClient();
  const { data } = await sb
    .from("fornecedor")
    .select("sync_uid,nome,documento,telefone,email,observacoes,ativo")
    .is("excluido_em", null)
    .order("nome");
  return (data as Fornecedor[]) ?? [];
}

export type EntradaFornecedor = Partial<Fornecedor> & { nome: string };

export async function salvarFornecedor(f: EntradaFornecedor): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const linha = {
    sync_uid: f.sync_uid ?? crypto.randomUUID(),
    nome: f.nome.trim(),
    nome_norm: normalizar(f.nome),
    documento: f.documento || null,
    telefone: f.telefone || null,
    email: f.email || null,
    observacoes: f.observacoes || null,
    ativo: f.ativo ?? true,
    origem: "escritorio",
    atualizado_em: new Date().toISOString(),
    criado_por: sessao.user?.id ?? null,
  };
  const { error } = await sb.from("fornecedor").upsert(linha, { onConflict: "sync_uid" });
  if (error) {
    return { error: error.message.includes("nome_norm") ? "Já existe um fornecedor com esse nome." : error.message };
  }
  return {};
}
