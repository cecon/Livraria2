// Camada de dados de destinações/fundos (US2/T030) — dedup por nome_norm; LWW.
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

export type Destinacao = {
  sync_uid: string;
  nome: string;
  de_sistema: boolean;
  ativa: boolean;
  ordem: number;
};

export async function listarDestinacoes(): Promise<Destinacao[]> {
  const sb = createClient();
  const { data } = await sb
    .from("destinacao")
    .select("sync_uid,nome,de_sistema,ativa,ordem")
    .is("excluido_em", null)
    .order("ordem")
    .order("nome");
  return (data as Destinacao[]) ?? [];
}

export type EntradaDestinacao = { sync_uid?: string; nome: string; ativa: boolean; ordem: number; de_sistema?: boolean };

export async function salvarDestinacao(d: EntradaDestinacao): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const linha = {
    sync_uid: d.sync_uid ?? crypto.randomUUID(),
    nome: d.nome.trim(),
    nome_norm: normalizar(d.nome),
    de_sistema: d.de_sistema ?? false,
    ativa: d.ativa,
    ordem: d.ordem || 0,
    origem: "escritorio",
    atualizado_em: new Date().toISOString(),
    criado_por: sessao.user?.id ?? null,
  };
  const { error } = await sb.from("destinacao").upsert(linha, { onConflict: "sync_uid" });
  if (error) {
    return { error: error.message.includes("nome_norm") ? "Já existe uma destinação com esse nome." : error.message };
  }
  return {};
}

export async function definirDestinacaoAtiva(sync_uid: string, ativa: boolean): Promise<{ error?: string }> {
  const sb = createClient();
  const { error } = await sb.from("destinacao").update({ ativa, atualizado_em: new Date().toISOString() }).eq("sync_uid", sync_uid);
  return error ? { error: error.message } : {};
}

export async function excluirDestinacao(sync_uid: string): Promise<{ error?: string }> {
  const sb = createClient();
  const agora = new Date().toISOString();
  const { error } = await sb.from("destinacao").update({ excluido_em: agora, atualizado_em: agora }).eq("sync_uid", sync_uid);
  return error ? { error: error.message } : {};
}

export async function reordenarDestinacoes(livresOrdenadas: Destinacao[]): Promise<{ error?: string }> {
  const sb = createClient();
  const agora = new Date().toISOString();
  // "Loja" (sistema) fica em 0; as livres seguem a partir de 1.
  for (let i = 0; i < livresOrdenadas.length; i++) {
    const { error } = await sb.from("destinacao").update({ ordem: i + 1, atualizado_em: agora }).eq("sync_uid", livresOrdenadas[i].sync_uid);
    if (error) return { error: error.message };
  }
  return {};
}
