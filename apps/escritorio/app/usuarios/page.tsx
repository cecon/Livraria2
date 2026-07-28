"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Gestão de usuários (feature 010, ADR-0019): cadastro/edição com **perfil** (operador/admin)
// e **senha**, desativar/reativar. Identidade única com o PDV. Escrita sensível passa pelas
// rotas server-side (`/api/usuarios*`) → RPCs (o hash vira bcrypt no Postgres; nunca lido).
type Usuario = { usuario: string; nome: string | null; perfil: string; excluido_em: string | null };

export default function Usuarios() {
  const supabase = createClient();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<"operador" | "admin">("operador");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("usuario").select("usuario,nome,perfil,excluido_em").order("usuario");
    setLista((data as Usuario[]) ?? []);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adminsAtivos = lista.filter((u) => u.perfil === "admin" && !u.excluido_em).length;
  const ehUltimoAdmin = (u: Usuario) => u.perfil === "admin" && !u.excluido_em && adminsAtivos <= 1;

  function fechar() {
    setAberto(false);
    setEditando(null);
    setUsuario("");
    setNome("");
    setPerfil("operador");
    setSenha("");
    setErro(null);
  }

  function abrirNovo() {
    fechar();
    setAberto(true);
  }
  function abrirEdicao(u: Usuario) {
    setErro(null);
    setEditando(u.usuario);
    setNome(u.nome ?? "");
    setPerfil(u.perfil === "admin" ? "admin" : "operador");
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!editando) {
      if (!usuario.trim()) return setErro("Informe o usuário.");
      if (senha.length < 4) return setErro("Senha deve ter ao menos 4 caracteres.");
    }
    setSalvando(true);
    const resp = await fetch("/api/usuarios", {
      method: editando ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editando ? { usuario: editando, nome, perfil } : { usuario: usuario.trim(), nome, perfil, senha },
      ),
    });
    setSalvando(false);
    if (!resp.ok) return setErro((await resp.json().catch(() => ({}))).erro ?? "Não foi possível salvar.");
    fechar();
    carregar();
  }

  async function acao(alvo: string, tipo: "senha" | "desativar" | "reativar", valor?: string) {
    const resp = await fetch("/api/usuarios/acao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: alvo, acao: tipo, senha: valor }),
    });
    if (!resp.ok) alert((await resp.json().catch(() => ({}))).erro ?? "Não foi possível concluir.");
    carregar();
  }

  function redefinirSenha(u: Usuario) {
    const s = window.prompt(`Nova senha para "${u.usuario}" (mínimo 4 caracteres):`);
    if (s == null) return;
    if (s.length < 4) return alert("Senha deve ter ao menos 4 caracteres.");
    acao(u.usuario, "senha", s);
  }

  const btn = "rounded-md px-2 py-1 text-xs";

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <button onClick={aberto && !editando ? fechar : abrirNovo} className="rounded-lg bg-[#1f7a4d] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {aberto && !editando ? "Fechar" : "Novo usuário"}
        </button>
      </div>

      {aberto && (
        <form onSubmit={salvar} className="mb-6 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="text-sm font-medium">{editando ? `Editando ${editando}` : "Novo usuário"}</div>
          <div className="grid grid-cols-2 gap-3">
            {!editando && (
              <label className="text-sm">
                Usuário
                <input className="mt-1 w-full rounded-md border px-3 py-2" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" />
              </label>
            )}
            <label className="text-sm">
              Nome
              <input className="mt-1 w-full rounded-md border px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>Perfil:</span>
            <label className="flex items-center gap-1">
              <input type="radio" checked={perfil === "operador"} onChange={() => setPerfil("operador")} /> Operador <span className="text-zinc-500">(só PDV)</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={perfil === "admin"} onChange={() => setPerfil("admin")} /> Admin <span className="text-zinc-500">(PDV + escritório)</span>
            </label>
          </div>
          {!editando && (
            <label className="block text-sm">
              Senha
              <input type="password" className="mt-1 w-full rounded-md border px-3 py-2" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            </label>
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando} className="rounded-lg bg-[#1f7a4d] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {salvando ? "Salvando…" : editando ? "Salvar" : "Cadastrar"}
            </button>
            <button type="button" onClick={fechar} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Usuário</th><th>Nome</th><th>Perfil</th><th>Estado</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {lista.length === 0 && <tr><td colSpan={5} className="py-4 text-zinc-500">Nenhum usuário.</td></tr>}
          {lista.map((u) => {
            const ultimo = ehUltimoAdmin(u);
            const ativo = !u.excluido_em;
            return (
              <tr key={u.usuario} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-2 font-medium">{u.usuario}</td>
                <td>{u.nome ?? "—"}</td>
                <td>{u.perfil === "admin" ? "Admin" : "Operador"}</td>
                <td>{ativo ? "Ativo" : "Desativado"}</td>
                <td className="space-x-1">
                  <button onClick={() => abrirEdicao(u)} className={`${btn} border`} title={ultimo ? "Último admin: não pode ser rebaixado" : ""}>Editar</button>
                  <button onClick={() => redefinirSenha(u)} className={`${btn} border`}>Senha</button>
                  {ativo ? (
                    <button
                      onClick={() => { if (confirm(`Desativar "${u.usuario}"?`)) acao(u.usuario, "desativar"); }}
                      disabled={ultimo}
                      className={`${btn} border text-red-600 disabled:opacity-40`}
                      title={ultimo ? "Precisa existir ao menos um admin" : ""}
                    >
                      Desativar
                    </button>
                  ) : (
                    <button onClick={() => acao(u.usuario, "reativar")} className={`${btn} border text-green-700`}>Reativar</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
