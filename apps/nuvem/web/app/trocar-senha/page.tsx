"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { KeyRound } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas nao conferem.");
      return;
    }
    setCarregando(true);
    const response = await fetch("/api/trocar-senha", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    setCarregando(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErro(body.erro || "Nao foi possivel trocar a senha.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthLayout title="Definir nova senha" description="Troque a senha temporária antes de continuar.">
      <form onSubmit={trocar} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Nova senha</Label>
            <Input className="h-10" id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirma">Confirmar senha</Label>
            <Input className="h-10" id="confirma" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} minLength={8} required />
          </div>
          {erro && <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2.5 text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={carregando} className="h-10 w-full">
            <KeyRound className="size-4" />
            {carregando ? "Salvando..." : "Salvar e continuar"}
          </Button>
      </form>
    </AuthLayout>
  );
}
