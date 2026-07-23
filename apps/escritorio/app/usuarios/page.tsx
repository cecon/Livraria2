"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Gestão de usuários (feature 010, ADR-0019). Cadastro com **perfil** (operador/admin) e
// **senha**. Identidade única com o PDV. A criação passa pela rota server-side
// `/api/usuarios` (a senha vira hash no Postgres; nunca trafega hash). A leitura usa
// colunas explícitas — o `senha_hash` nunca é lido.
type Usuario = { usuario: string; nome: string | null; perfil: string; excluido_em: string | null };

export default function Usuarios() {
  const supabase = createClient();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<"operador" | "admin">("operador");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("usuario")
      .select("usuario,nome,perfil,excluido_em")
      .order("usuario");
    setLista((data as Usuario[]) ?? []);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpar() {
    setUsuario("");
    setNome("");
    setPerfil("operador");
    setSenha("");
    setErro(null);
    setNovoAberto(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!usuario.trim()) return setErro("Informe o usuário.");
    if (senha.length < 4) return setErro("Senha deve ter ao menos 4 caracteres.");
    setSalvando(true);
    const resp = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: usuario.trim(), nome, perfil, senha }),
    });
    setSalvando(false);
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      return setErro(j.erro ?? "Não foi possível cadastrar.");
    }
    limpar();
    carregar();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <button
          onClick={() => setNovoAberto((v) => !v)}
          className="rounded-lg bg-[#1f7a4d] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {novoAberto ? "Fechar" : "Novo usuário"}
        </button>
      </div>

      {novoAberto && (
        <form onSubmit={salvar} className="mb-6 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Usuário
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="text-sm">
              Nome
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>Perfil:</span>
            <label className="flex items-center gap-1">
              <input type="radio" checked={perfil === "operador"} onChange={() => setPerfil("operador")} />
              Operador <span className="text-zinc-500">(só PDV)</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={perfil === "admin"} onChange={() => setPerfil("admin")} />
              Admin <span className="text-zinc-500">(PDV + escritório)</span>
            </label>
          </div>
          <label className="block text-sm">
            Senha
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-[#1f7a4d] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Cadastrar"}
          </button>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-2">Usuário</th>
            <th>Nome</th>
            <th>Perfil</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-zinc-500">
                Nenhum usuário.
              </td>
            </tr>
          )}
          {lista.map((u) => (
            <tr key={u.usuario} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2 font-medium">{u.usuario}</td>
              <td>{u.nome ?? "—"}</td>
              <td>{u.perfil === "admin" ? "Admin" : "Operador"}</td>
              <td>{u.excluido_em ? "Desativado" : "Ativo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
