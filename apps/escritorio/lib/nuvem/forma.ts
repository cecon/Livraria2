// Camada de dados de formas de pagamento (US2/T029) — dedup por chave; LWW.
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

export type Forma = {
  sync_uid: string;
  chave: string;
  rotulo: string;
  de_sistema: boolean;
  ativa: boolean;
  ordem: number;
};

export async function listarFormas(): Promise<Forma[]> {
  const sb = createClient();
  const { data } = await sb
    .from("forma_pagamento")
    .select("sync_uid,chave,rotulo,de_sistema,ativa,ordem")
    .is("excluido_em", null)
    .order("ordem")
    .order("rotulo");
  return (data as Forma[]) ?? [];
}

export type EntradaForma = {
  sync_uid?: string;
  chave?: string;
  rotulo: string;
  ativa: boolean;
  ordem: number;
  de_sistema?: boolean;
};

export async function salvarForma(f: EntradaForma): Promise<{ error?: string }> {
  const sb = createClient();
  const { data: sessao } = await sb.auth.getUser();
  const linha = {
    sync_uid: f.sync_uid ?? crypto.randomUUID(),
    chave: f.chave ?? normalizar(f.rotulo).replace(/\s+/g, "_"),
    rotulo: f.rotulo.trim(),
    de_sistema: f.de_sistema ?? false,
    ativa: f.ativa,
    ordem: f.ordem || 0,
    origem: "escritorio",
    atualizado_em: new Date().toISOString(),
    criado_por: sessao.user?.id ?? null,
  };
  const { error } = await sb.from("forma_pagamento").upsert(linha, { onConflict: "sync_uid" });
  if (error) {
    return { error: error.message.includes("chave") ? "Já existe uma forma com essa chave." : error.message };
  }
  return {};
}
