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
