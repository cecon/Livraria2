"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/interface/ui/button";
import { Input } from "@/interface/ui/input";
import { Label } from "@/interface/ui/label";
import { LogIn, UserRound } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

// Login por **usuário** (tabela `usuario`, ADR-0019) — mesma identidade do PDV.
// Sessao validada no servidor; interface MUI da retaguarda.
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
    try {
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
    const requested = new URLSearchParams(window.location.search).get("next");
    const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
    router.replace(destination);
    router.refresh();
    } catch { setErro("Não foi possível conectar. Confira a conexão e tente novamente."); }
    finally { setCarregando(false); }
  }

  return (
    <AuthLayout title="Bem-vindo de volta" description="Entre com seu usuário para acessar o escritório.">
      <form onSubmit={entrar} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="usuario">Usuário</Label>
          <div className="relative">

            <Input startIcon={<UserRound size={16} />} className="h-10" id="usuario" type="text" autoComplete="username" autoCapitalize="none" value={usuario}
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
