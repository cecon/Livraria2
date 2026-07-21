"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { centavos, normalizar, reais } from "@/utils/texto";

type Livro = {
  sync_uid: string;
  codigo: string;
  titulo: string;
  autor: string | null;
  preco_centavos: number;
  categoria: number;
  ativo: boolean;
};

const vazio = () => ({ codigo: "", titulo: "", autor: "", preco: "", categoria: 0, ativo: true, sync_uid: undefined as string | undefined });

// T035 — cadastro/preço de livro (dedup por código de barras; LWW).
export default function Livros() {
  const supabase = createClient();
  const [lista, setLista] = useState<Livro[]>([]);
  const [form, setForm] = useState(vazio());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("livro")
      .select("sync_uid,codigo,titulo,autor,preco_centavos,categoria,ativo")
      .is("excluido_em", null)
      .order("titulo")
      .limit(200);
    setLista((data as Livro[]) ?? []);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.codigo.trim() || !form.titulo.trim()) {
      setErro("Código de barras e título são obrigatórios.");
      return;
    }
    setSalvando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const linha = {
      sync_uid: form.sync_uid ?? crypto.randomUUID(),
      codigo: form.codigo.trim(),
      titulo: form.titulo.trim(),
      autor: form.autor || null,
      preco_centavos: centavos(form.preco),
      categoria: Number(form.categoria) || 0,
      busca_norm: normalizar(`${form.titulo} ${form.autor} ${form.codigo}`),
      ativo: form.ativo,
      origem: "escritorio",
      atualizado_em: new Date().toISOString(),
      criado_por: sessao.user?.id ?? null,
    };
    const { error } = await supabase.from("livro").upsert(linha, { onConflict: "sync_uid" });
    setSalvando(false);
    if (error) {
      setErro(error.message.includes("codigo") ? "Já existe um livro com esse código de barras." : error.message);
      return;
    }
    setForm(vazio());
    carregar();
  }

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Cadastro / preço de livros</h1>
      <form onSubmit={salvar}>
        <label>Código de barras</label>
        <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        <label>Título</label>
        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <label>Autor</label>
        <input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
        <label>Preço (R$)</label>
        <input inputMode="decimal" placeholder="0,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={salvando}>{form.sync_uid ? "Salvar" : "Adicionar"}</button>
        {form.sync_uid && <button type="button" onClick={() => setForm(vazio())} style={{ background: "#777", marginLeft: 8 }}>Cancelar</button>}
      </form>

      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Acervo</h2>
      <ul>
        {lista.map((l) => (
          <li key={l.sync_uid} style={{ margin: "6px 0" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setForm({ codigo: l.codigo, titulo: l.titulo, autor: l.autor ?? "", preco: (l.preco_centavos / 100).toString().replace(".", ","), categoria: l.categoria, ativo: l.ativo, sync_uid: l.sync_uid }); }}>
              {l.codigo} — {l.titulo}
            </a>{" "}
            <small>{reais(l.preco_centavos)}</small>
          </li>
        ))}
      </ul>
    </main>
  );
}
