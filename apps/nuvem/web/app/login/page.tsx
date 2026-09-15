"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";

// Login por **usuário** (tabela `usuario`, ADR-0019) — mesma identidade do PDV.
// Validação/sessão server-side em /api/login. UI no design system (@livraria/ui).
export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const resp = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, senha }),
    });
    setCarregando(false);
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      setErro(j.erro ?? "Não foi possível entrar.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Entrar - Escritório</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Acesse a retaguarda da livraria.</p>
        <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="usuario">Usuário</Label>
          <Input id="usuario" type="text" autoComplete="username" autoCapitalize="none" value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase())} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={carregando} className="w-full">
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
        </div>
      </form>
    </main>
  );
}
