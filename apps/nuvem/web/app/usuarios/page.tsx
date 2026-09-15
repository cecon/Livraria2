"use client";

import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { ContentPanel } from "@/components/ContentPanel";
import { PageHeader } from "@/components/PageHeader";

// Gestão de usuários (feature 010, ADR-0019): cadastro/edição com **perfil** (operador/admin)
// e **senha**, desativar/reativar. Identidade única com o PDV. Escrita sensível passa pelas
// rotas server-side (`/api/usuarios*`) da API da nuvem.
type Usuario = { usuario: string; nome: string | null; perfil: string; excluido_em: string | null };

export default function Usuarios() {
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
    const response = await fetch("/api/usuarios", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setErro(data.erro || "Nao foi possivel carregar os usuarios.");
    setLista(data as Usuario[]);
  }
  useEffect(() => {
    carregar();
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

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title={editando ? "Editar usuário" : aberto ? "Novo usuário" : "Usuários"}
        description="Gerencie os acessos compartilhados entre o PDV e o escritório."
        crumbs={aberto
          ? [{ label: "Administração" }, { label: "Usuários", onClick: fechar }, { label: editando ? "Editar" : "Novo" }]
          : [{ label: "Administração" }, { label: "Usuários" }]}
        back={aberto ? { label: "Voltar para usuários", onClick: fechar } : undefined}
        action={!aberto ? <Button onClick={abrirNovo} className="h-10">
          <Plus className="size-4" /> Novo usuário
        </Button> : undefined}
      />

      {aberto && (
        <ContentPanel
          title={editando ? `Dados de ${editando}` : "Dados do usuário"}
          description={editando ? "Atualize o nome e o nível de acesso." : "Crie a identificação e defina o acesso inicial."}
        >
        <form onSubmit={salvar} className="admin-form space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!editando && (
              <div>
                <Label htmlFor="usuario">Usuário</Label>
                <Input id="usuario" className="mt-1 h-10" value={usuario}
                  onChange={(e) => setUsuario(e.target.value.toLowerCase())} autoCapitalize="none" autoComplete="off" />
              </div>
            )}
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" className="mt-1 h-10" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="mb-2 font-medium">Perfil</legend>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3">
              <input className="accent-primary" type="radio" checked={perfil === "operador"} onChange={() => setPerfil("operador")} />
              Operador <span className="text-muted-foreground">(só PDV)</span>
            </label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3">
              <input className="accent-primary" type="radio" checked={perfil === "admin"} onChange={() => setPerfil("admin")} />
              Admin <span className="text-muted-foreground">(PDV + escritório)</span>
            </label>
          </fieldset>
          {!editando && (
            <div>
              <Label htmlFor="nova-senha">Senha</Label>
              <Input id="nova-senha" type="password" className="mt-1 h-10" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            </div>
          )}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={salvando} className="h-10">
              {salvando ? "Salvando…" : editando ? "Salvar" : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" onClick={fechar} className="h-10">Cancelar</Button>
          </div>
        </form>
        </ContentPanel>
      )}

      <ContentPanel
        title="Usuários cadastrados"
        description={`${lista.length} usuário(s), incluindo acessos desativados.`}
        flush
      >
      <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead className="text-left text-muted-foreground">
          <tr><th className="p-3">Usuário</th><th className="hidden p-3 lg:table-cell">Nome</th><th className="hidden w-24 p-3 sm:table-cell">Perfil</th><th className="hidden w-28 p-3 md:table-cell">Estado</th><th className="w-[116px] p-3 text-right">Ações</th></tr>
        </thead>
        <tbody>
          {lista.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuário.</td></tr>}
          {lista.map((u) => {
            const ultimo = ehUltimoAdmin(u);
            const ativo = !u.excluido_em;
            return (
              <tr key={u.usuario} className="border-t">
                <td className="p-3 font-medium">
                  <div className="truncate">{u.usuario}</div>
                  <div className="truncate text-[11px] font-normal text-muted-foreground lg:hidden">{u.nome ?? "Sem nome"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-normal sm:hidden">
                    <span>{u.perfil === "admin" ? "Admin" : "Operador"}</span>
                    <span className={ativo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{ativo ? "Ativo" : "Desativado"}</span>
                  </div>
                </td>
                <td className="hidden p-3 lg:table-cell">{u.nome ?? "—"}</td>
                <td className="hidden p-3 sm:table-cell">{u.perfil === "admin" ? "Admin" : "Operador"}</td>
                <td className="hidden p-3 md:table-cell"><span className={`rounded px-2 py-1 text-xs font-medium ${ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{ativo ? "Ativo" : "Desativado"}</span></td>
                <td className="space-x-1 p-3 text-right">
                  <Button size="icon-sm" variant="outline" onClick={() => abrirEdicao(u)} title={ultimo ? "Último admin: não pode ser rebaixado" : "Editar"}><Pencil /></Button>
                  <Button size="icon-sm" variant="outline" onClick={() => redefinirSenha(u)} title="Redefinir senha"><KeyRound /></Button>
                  {ativo ? (
                    <Button size="icon-sm" variant="destructive"
                      onClick={() => { if (confirm(`Desativar "${u.usuario}"?`)) acao(u.usuario, "desativar"); }}
                      disabled={ultimo}
                      title={ultimo ? "Precisa existir ao menos um admin" : ""}
                    >
                      <UserX />
                    </Button>
                  ) : (
                    <Button size="icon-sm" variant="outline" onClick={() => acao(u.usuario, "reativar")} title="Reativar"><UserCheck className="text-emerald-600" /></Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      </ContentPanel>
    </main>
  );
}
