// Camada de dados do Escritório para `livro` (US2) — grava por sync_uid (LWW),
// dedup por `codigo`. Estoque é derivado dos movimentos (não é coluna).
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

export type Livro = {
  sync_uid: string;
  codigo: string;
  titulo: string;
  autor: string | null;
  preco_centavos: number;
  categoria: number;
  descricao: string | null;
  ativo: boolean;
};

export async function listarLivros(): Promise<Livro[]> {
  const sb = createClient();
  const { data } = await sb
    .from("livro")
    .select("sync_uid,codigo,titulo,autor,preco_centavos,categoria,descricao,ativo")
    .is("excluido_em", null)
    .order("titulo")
    .limit(2000);
  return (data as Livro[]) ?? [];
}

export type EntradaLivro = {
  sync_uid?: string;
  codigo: string;
  titulo: string;
  autor: string;
  preco_centavos: number;
  categoria: number;
  descricao: string;
  estoqueInicial?: number; // só para livro NOVO — vira um movimento `saldo_inicial`.
};

export async function salvarLivro(e: EntradaLivro): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const criadoPor = sessao.user?.id ?? null;
  const agora = new Date().toISOString();
  const novo = !e.sync_uid;
  const uid = e.sync_uid ?? crypto.randomUUID();

  const linha = {
    sync_uid: uid,
    codigo: e.codigo.trim(),
    titulo: e.titulo.trim(),
    autor: e.autor.trim() || null,
    preco_centavos: e.preco_centavos,
    categoria: e.categoria || 0,
    descricao: e.descricao.trim() || null,
    busca_norm: normalizar(`${e.titulo} ${e.autor} ${e.codigo}`),
    ativo: true,
    origem: "escritorio",
    atualizado_em: agora,
    criado_por: criadoPor,
  };
  const { error } = await sb.from("livro").upsert(linha, { onConflict: "sync_uid" });
  if (error) {
    return { error: error.message.includes("codigo") ? "Já existe um livro com esse código de barras." : error.message };
  }

  // Livro novo com estoque inicial: registra o baseline como movimento saldo_inicial.
  if (novo && e.estoqueInicial && e.estoqueInicial !== 0) {
    await sb.from("movimento_estoque").insert({
      sync_uid: crypto.randomUUID(),
      livro_uid: uid,
      tipo: "saldo_inicial",
      qtd: e.estoqueInicial,
      criado_em: agora,
      origem: "escritorio",
      criado_por: criadoPor,
    });
  }
  return {};
}

export async function excluirLivro(sync_uid: string): Promise<{ error?: string }> {
  const sb = createClient();
  const agora = new Date().toISOString();
  const { error } = await sb.from("livro").update({ excluido_em: agora, atualizado_em: agora }).eq("sync_uid", sync_uid);
  if (error) return { error: error.message };
  return {};
}
