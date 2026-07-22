"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Livro = { sync_uid: string; codigo: string; titulo: string };
type Fornecedor = { sync_uid: string; nome: string };

// centavos a partir de "12,50" / "12.50" / "12"
function centavos(txt: string): number {
  const n = parseFloat(txt.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// US1 — Receber livros: cria lançamento + item + movimento de entrada na nuvem,
// como eventos crus (origem='escritorio'), relações por sync_uid. Funciona com o
// notebook do PDV desligado; o PDV reflete ao sincronizar.
export default function Recebimento() {
  const supabase = createClient();
  const [livros, setLivros] = useState<Livro[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [livroUid, setLivroUid] = useState("");
  const [fornecedorUid, setFornecedorUid] = useState("");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const [l, f] = await Promise.all([
        supabase.from("livro").select("sync_uid,codigo,titulo").is("excluido_em", null).order("titulo"),
        supabase.from("fornecedor").select("sync_uid,nome").is("excluido_em", null).order("nome"),
      ]);
      setLivros((l.data as Livro[]) ?? []);
      setFornecedores((f.data as Fornecedor[]) ?? []);
    })();
  }, [supabase]);

  async function receber(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    const q = parseInt(qtd, 10);
    if (!livroUid || !Number.isFinite(q) || q <= 0) {
      setErro("Escolha o livro e uma quantidade válida.");
      return;
    }
    setSalvando(true);
    const custoC = centavos(custo);
    const { data: sessao } = await supabase.auth.getUser();
    const criadoPor = sessao.user?.id ?? null;
    const agora = new Date().toISOString();
    const lancUid = crypto.randomUUID();

    const lanc = {
      sync_uid: lancUid,
      fornecedor_uid: fornecedorUid || null,
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
      livro_uid: livroUid,
      qtd: q,
      custo_unit_centavos: custoC,
      origem: "escritorio",
      criado_por: criadoPor,
    };
    const mov = {
      sync_uid: crypto.randomUUID(),
      livro_uid: livroUid,
      tipo: "entrada",
      qtd: q,
      custo_unit_centavos: custoC,
      criado_em: agora,
      origem: "escritorio",
      criado_por: criadoPor,
    };

    // Pai antes das filhas (FKs por sync_uid).
    const r1 = await supabase.from("lancamento_entrada").insert(lanc);
    const r2 = r1.error ? r1 : await supabase.from("item_lancamento").insert(item);
    const r3 = r2.error ? r2 : await supabase.from("movimento_estoque").insert(mov);
    setSalvando(false);

    if (r1.error || r2.error || r3.error) {
      setErro((r1.error || r2.error || r3.error)!.message);
      return;
    }
    const livro = livros.find((x) => x.sync_uid === livroUid);
    setMsg(`Entrada de ${q} de "${livro?.titulo}" registrada. O PDV refletirá ao sincronizar.`);
    setQtd("");
    setCusto("");
  }

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Receber livros</h1>
      <form onSubmit={receber}>
        <label htmlFor="livro">Livro</label>
        <select id="livro" value={livroUid} onChange={(e) => setLivroUid(e.target.value)}>
          <option value="">— selecione —</option>
          {livros.map((l) => (
            <option key={l.sync_uid} value={l.sync_uid}>
              {l.codigo} — {l.titulo}
            </option>
          ))}
        </select>

        <label htmlFor="forn">Fornecedor (opcional)</label>
        <select id="forn" value={fornecedorUid} onChange={(e) => setFornecedorUid(e.target.value)}>
          <option value="">— nenhum —</option>
          {fornecedores.map((f) => (
            <option key={f.sync_uid} value={f.sync_uid}>{f.nome}</option>
          ))}
        </select>

        <label htmlFor="qtd">Quantidade</label>
        <input id="qtd" type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />

        <label htmlFor="custo">Custo unitário (R$)</label>
        <input id="custo" inputMode="decimal" placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} />

        {erro && <p className="erro">{erro}</p>}
        {msg && <p style={{ color: "#1a7f37", marginTop: 8 }}>{msg}</p>}
        <button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Registrar entrada"}</button>
      </form>
    </main>
  );
}
