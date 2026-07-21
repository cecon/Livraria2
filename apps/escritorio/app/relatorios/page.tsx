"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { reais } from "@/utils/texto";

type Linha = { rotulo: string; total: number };

// T043 (US5) — relatórios: total por forma de pagamento (005) e repasse por
// destinação (006). Agrega no cliente (PostgREST não soma).
export default function Relatorios() {
  const supabase = createClient();
  const [pagamentos, setPagamentos] = useState<Linha[]>([]);
  const [destinacoes, setDestinacoes] = useState<Linha[]>([]);

  useEffect(() => {
    (async () => {
      const [pp, fp, av, de] = await Promise.all([
        supabase.from("pagamento_pedido").select("forma_uid,valor_centavos"),
        supabase.from("forma_pagamento").select("sync_uid,rotulo"),
        supabase.from("alocacao_venda").select("destinacao_uid,valor_centavos"),
        supabase.from("destinacao").select("sync_uid,nome"),
      ]);
      setPagamentos(agrupar(pp.data ?? [], "forma_uid", fp.data ?? [], "rotulo"));
      setDestinacoes(agrupar(av.data ?? [], "destinacao_uid", de.data ?? [], "nome"));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Relatórios</h1>

      <h2 style={{ fontSize: "1.1rem" }}>Por forma de pagamento</h2>
      <Tabela linhas={pagamentos} />

      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Repasse por destinação</h2>
      <Tabela linhas={destinacoes} />
    </main>
  );
}

function Tabela({ linhas }: { linhas: Linha[] }) {
  if (linhas.length === 0) return <p style={{ color: "#777" }}>Nada sincronizado ainda.</p>;
  const total = linhas.reduce((s, l) => s + l.total, 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.rotulo} style={{ borderBottom: "1px solid #eee" }}>
            <td>{l.rotulo}</td>
            <td style={{ textAlign: "right" }}>{reais(l.total)}</td>
          </tr>
        ))}
        <tr style={{ fontWeight: 600 }}>
          <td>Total</td>
          <td style={{ textAlign: "right" }}>{reais(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

type Item = { valor_centavos: number } & Record<string, unknown>;
type Ref = { sync_uid: string } & Record<string, unknown>;

function agrupar(itens: Item[], chaveUid: string, refs: Ref[], rotuloCampo: string): Linha[] {
  const nomes = new Map(refs.map((r) => [r.sync_uid, String(r[rotuloCampo] ?? "—")]));
  const soma = new Map<string, number>();
  for (const it of itens) {
    const uid = String(it[chaveUid] ?? "");
    soma.set(uid, (soma.get(uid) ?? 0) + (it.valor_centavos ?? 0));
  }
  return [...soma.entries()]
    .map(([uid, total]) => ({ rotulo: nomes.get(uid) ?? "—", total }))
    .sort((a, b) => b.total - a.total);
}
