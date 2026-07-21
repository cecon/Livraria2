"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { normalizar } from "@/utils/texto";

type Fornecedor = {
  sync_uid: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const vazio = (): Partial<Fornecedor> => ({ nome: "", documento: "", telefone: "", email: "", observacoes: "", ativo: true });

// T034 — cadastro/edição de fornecedores (dedup por nome_norm; LWW por atualizado_em).
export default function Fornecedores() {
  const supabase = createClient();
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState<Partial<Fornecedor>>(vazio());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("fornecedor").select("*").is("excluido_em", null).order("nome");
    setLista((data as Fornecedor[]) ?? []);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome?.trim()) {
      setErro("Informe o nome.");
      return;
    }
    setSalvando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const linha = {
      sync_uid: form.sync_uid ?? crypto.randomUUID(),
      nome: form.nome.trim(),
      nome_norm: normalizar(form.nome),
      documento: form.documento || null,
      telefone: form.telefone || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
      ativo: form.ativo ?? true,
      origem: "escritorio",
      atualizado_em: new Date().toISOString(),
      criado_por: sessao.user?.id ?? null,
    };
    const { error } = await supabase.from("fornecedor").upsert(linha, { onConflict: "sync_uid" });
    setSalvando(false);
    if (error) {
      setErro(error.message.includes("nome_norm") ? "Já existe um fornecedor com esse nome." : error.message);
      return;
    }
    setForm(vazio());
    carregar();
  }

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Fornecedores</h1>
      <form onSubmit={salvar}>
        <label>Nome</label>
        <input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label>Documento (CNPJ/CPF)</label>
        <input value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
        <label>Telefone</label>
        <input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <label>E-mail</label>
        <input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={salvando}>{form.sync_uid ? "Salvar" : "Adicionar"}</button>
        {form.sync_uid && <button type="button" onClick={() => setForm(vazio())} style={{ background: "#777", marginLeft: 8 }}>Cancelar</button>}
      </form>

      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Cadastrados</h2>
      <ul>
        {lista.map((f) => (
          <li key={f.sync_uid} style={{ margin: "6px 0" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setForm(f); }}>{f.nome}</a>
            {f.documento ? ` — ${f.documento}` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
