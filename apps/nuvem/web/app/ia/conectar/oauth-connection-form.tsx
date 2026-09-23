"use client";

import { useMemo, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";

export function OAuthConnectionForm({ params }: { params: Record<string, string> }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const modo = (params.scope || "").split(/\s+/).includes("livraria:write")
    ? "Consultas e alterações"
    : "Somente consultas";
  const destino = useMemo(() => {
    try {
      return new URL(params.resource || "").host || "conector";
    } catch {
      return "conector";
    }
  }, [params.resource]);

  async function autorizar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/ia/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...params, usuario, senha }),
      });
      const body = await resposta.json().catch(() => ({}));
      if (!resposta.ok || typeof body.redirect !== "string") {
        throw new Error(body.message || body.erro || "Não foi possível autorizar o conector.");
      }
      window.location.assign(body.redirect);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Confira os dados e tente novamente.");
    } finally {
      setCarregando(false);
      setSenha("");
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Conectar assistente</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Entre na Livraria para autorizar este conector temporariamente.
        </p>
        {erro ? (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <div className="mb-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{destino}</p>
          <p className="mt-1 text-muted-foreground">{modo} por 1 hora.</p>
        </div>
        <form onSubmit={autorizar} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="oauth-usuario">Usuário</Label>
            <Input
              id="oauth-usuario"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value.toLowerCase())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="oauth-senha">Senha</Label>
            <Input
              id="oauth-senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <Button className="w-full" type="submit" disabled={carregando}>
            {carregando ? "Conectando..." : "Autorizar conector"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Sua senha fica somente nesta tela. O conector recebe um acesso temporário auditado e revogável.
        </p>
      </section>
    </main>
  );
}
