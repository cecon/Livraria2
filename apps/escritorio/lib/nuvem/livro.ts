// Camada de dados do Escritório para `livro` (US2/T024) — PostgREST via supabase-js.
// Grava por sync_uid (LWW por atualizado_em de servidor), dedup por `codigo` (ADR-0016).
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

export type Livro = {
  sync_uid: string;
  codigo: string;
  titulo: string;
  autor: string | null;
  preco_centavos: number;
  categoria: number;
  ativo: boolean;
};

export async function listarLivros(): Promise<Livro[]> {
  const sb = createClient();
  const { data } = await sb
    .from("livro")
    .select("sync_uid,codigo,titulo,autor,preco_centavos,categoria,ativo")
    .is("excluido_em", null)
    .order("titulo")
    .limit(200);
  return (data as Livro[]) ?? [];
}

export type EntradaLivro = {
  sync_uid?: string;
  codigo: string;
  titulo: string;
  autor: string;
  preco_centavos: number;
  categoria: number;
  ativo: boolean;
};

export async function salvarLivro(e: EntradaLivro): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const linha = {
    sync_uid: e.sync_uid ?? crypto.randomUUID(),
    codigo: e.codigo.trim(),
    titulo: e.titulo.trim(),
    autor: e.autor || null,
    preco_centavos: e.preco_centavos,
    categoria: e.categoria || 0,
    busca_norm: normalizar(`${e.titulo} ${e.autor} ${e.codigo}`),
    ativo: e.ativo,
    origem: "escritorio",
    atualizado_em: new Date().toISOString(),
    criado_por: sessao.user?.id ?? null,
  };
  const { error } = await sb.from("livro").upsert(linha, { onConflict: "sync_uid" });
  if (error) {
    return { error: error.message.includes("codigo") ? "Já existe um livro com esse código de barras." : error.message };
  }
  return {};
}
