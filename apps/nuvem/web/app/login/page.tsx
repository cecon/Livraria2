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
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold">Entrar — Escritório</h1>
      <form onSubmit={entrar} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="usuario">Usuário</Label>
          <Input id="usuario" type="text" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
