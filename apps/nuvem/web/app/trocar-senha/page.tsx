"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { createClient } from "@/utils/supabase/client";

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
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { must_change_password: false },
    });
    setCarregando(false);
    if (error) {
      setErro(error.message || "Nao foi possivel trocar a senha.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <form onSubmit={trocar} className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold">Definir nova senha</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Por seguranca, troque a senha temporaria antes de continuar.</p>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Nova senha</Label>
            <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirma">Confirmar senha</Label>
            <Input id="confirma" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} minLength={8} required />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={carregando} className="w-full">
            {carregando ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </div>
      </form>
    </main>
  );
}
