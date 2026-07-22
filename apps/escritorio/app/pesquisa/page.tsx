"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { reais } from "@/utils/texto";

type Saldo = { livro_uid: string; codigo: string; saldo: number };
type Livro = { sync_uid: string; titulo: string };
type Venda = { sync_uid: string; numero: number; data: string; total_centavos: number; operador_uid: string | null };
type Operador = { sync_uid: string; usuario: string; nome: string | null };

// T038/T044 — consulta de estoque (vw_saldo_livro) e vendas ("vendido por").
export default function Consulta() {
  const supabase = createClient();
  const [estoque, setEstoque] = useState<{ codigo: string; titulo: string; saldo: number }[]>([]);
  const [vendas, setVendas] = useState<(Venda & { operador: string })[]>([]);

  useEffect(() => {
    (async () => {
      const [s, l, v, o] = await Promise.all([
        supabase.from("vw_saldo_livro").select("*").order("codigo"),
        supabase.from("livro").select("sync_uid,titulo").is("excluido_em", null),
        supabase.from("pedido").select("sync_uid,numero,data,total_centavos,operador_uid").eq("cancelado", false).order("numero", { ascending: false }).limit(50),
        supabase.from("usuario").select("sync_uid,usuario,nome"),
      ]);
      const titulos = new Map((l.data as Livro[] ?? []).map((x) => [x.sync_uid, x.titulo]));
      setEstoque(
        (s.data as Saldo[] ?? []).map((x) => ({ codigo: x.codigo, titulo: titulos.get(x.livro_uid) ?? x.codigo, saldo: x.saldo }))
      );
      const ops = new Map((o.data as Operador[] ?? []).map((x) => [x.sync_uid, x.nome || x.usuario]));
      setVendas(
        (v.data as Venda[] ?? []).map((x) => ({ ...x, operador: x.operador_uid ? ops.get(x.operador_uid) ?? "—" : "desconhecido" }))
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Estoque &amp; vendas</h1>

      <h2 style={{ fontSize: "1.1rem" }}>Estoque</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {estoque.map((e) => (
            <tr key={e.codigo} style={{ borderBottom: "1px solid #eee" }}>
              <td>{e.titulo}</td>
              <td style={{ textAlign: "right" }}>{e.saldo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Vendas recentes</h2>
      {vendas.length === 0 && <p style={{ color: "#777" }}>Nenhuma venda sincronizada ainda.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {vendas.map((v) => (
            <tr key={v.sync_uid} style={{ borderBottom: "1px solid #eee" }}>
              <td>#{v.numero}</td>
              <td>{v.data?.slice(0, 10)}</td>
              <td>vendido por {v.operador}</td>
              <td style={{ textAlign: "right" }}>{reais(v.total_centavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
