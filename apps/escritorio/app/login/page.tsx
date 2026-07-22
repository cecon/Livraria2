"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Login por **usuário** (tabela `usuario`, ADR-0019) — a mesma identidade do PDV.
// A validação e a sessão são estabelecidas server-side em /api/login.
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
    <main>
      <h1>Entrar — Escritório</h1>
      <form onSubmit={entrar}>
        <label htmlFor="usuario">Usuário</label>
        <input
          id="usuario"
          type="text"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />
        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
