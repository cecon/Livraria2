"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Login por usuário (Supabase Auth). Sem sessão, o middleware manda pra cá.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main>
      <h1>Entrar — Escritório</h1>
      <form onSubmit={entrar}>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
