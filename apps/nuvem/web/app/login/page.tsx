"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { LogIn, UserRound } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

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
    <AuthLayout title="Bem-vindo de volta" description="Entre com seu usuário para acessar o escritório.">
      <form onSubmit={entrar} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="usuario">Usuário</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="h-10 pl-9" id="usuario" type="text" autoComplete="username" autoCapitalize="none" value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase())} required />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input className="h-10" id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2.5 text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={carregando} className="mt-1 h-10 w-full">
          <LogIn className="size-4" />
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}
