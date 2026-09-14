"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Operador = { sync_uid: string; usuario: string; nome: string | null };

// T037 — cadastro de operadores do PDV (só identidade; senha é definida no PDV
// no 1º uso — D15). Dedup por `usuario`; LWW por atualizado_em.
export default function Operadores() {
  const supabase = createClient();
  const [lista, setLista] = useState<Operador[]>([]);
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [editUid, setEditUid] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("usuario").select("sync_uid,usuario,nome").is("excluido_em", null).order("usuario");
    setLista((data as Operador[]) ?? []);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpar() {
    setUsuario("");
    setNome("");
    setEditUid(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!usuario.trim()) {
      setErro("Informe o usuário.");
      return;
    }
    setSalvando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const linha = {
      sync_uid: editUid ?? crypto.randomUUID(),
      usuario: usuario.trim(),
      nome: nome || null,
      origem: "escritorio",
      atualizado_em: new Date().toISOString(),
      criado_por: sessao.user?.id ?? null,
    };
    const { error } = await supabase.from("usuario").upsert(linha, { onConflict: "sync_uid" });
    setSalvando(false);
    if (error) {
      setErro(error.message.includes("usuario") ? "Já existe um operador com esse usuário." : error.message);
      return;
    }
    limpar();
    carregar();
  }

  return (
    <main>
      <p><a href="/">← voltar</a></p>
      <h1>Operadores do PDV</h1>
      <p style={{ fontSize: "0.9rem", color: "#555" }}>
        A <strong>senha é definida no PDV</strong> no primeiro login (nunca trafega pela nuvem).
      </p>
      <form onSubmit={salvar}>
        <label>Usuário</label>
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} disabled={!!editUid} />
        <label>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={salvando}>{editUid ? "Salvar" : "Adicionar"}</button>
        {editUid && <button type="button" onClick={limpar} style={{ background: "#777", marginLeft: 8 }}>Cancelar</button>}
      </form>

      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Operadores</h2>
      <ul>
        {lista.map((o) => (
          <li key={o.sync_uid} style={{ margin: "6px 0" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setEditUid(o.sync_uid); setUsuario(o.usuario); setNome(o.nome ?? ""); }}>
              {o.usuario}
            </a>
            {o.nome ? ` — ${o.nome}` : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
