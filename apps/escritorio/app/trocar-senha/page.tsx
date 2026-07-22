"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Troca de senha obrigatória no primeiro acesso (senha temporária). O middleware
// força a vinda pra cá enquanto user_metadata.must_change_password for true; ao
// gravar a nova senha limpamos a flag e liberamos o app.
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
      setErro("As senhas não conferem.");
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
      setErro(error.message || "Não foi possível trocar a senha.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main>
      <h1>Definir nova senha</h1>
      <p>Por segurança, troque a senha temporária antes de continuar.</p>
      <form onSubmit={trocar}>
        <label htmlFor="senha">Nova senha</label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={8}
          required
        />
        <label htmlFor="confirma">Confirmar senha</label>
        <input
          id="confirma"
          type="password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          minLength={8}
          required
        />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={carregando}>
          {carregando ? "Salvando…" : "Salvar e continuar"}
        </button>
      </form>
    </main>
  );
}
