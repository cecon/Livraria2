// Operador logado (feature 009, D10): resolve o `usuario.sync_uid` REAL via
// `/api/operador` (que lê o cookie httpOnly `app_user`). É essa identidade que
// carimba turno e venda — nunca o `auth.uid()` da sessão de serviço compartilhada.
"use client";

export type Operador = { uid: string; login: string; nome: string };

let cache: Promise<Operador> | null = null;

export function operadorAtual(): Promise<Operador> {
  if (!cache) {
    cache = fetch("/api/operador")
      .then(async (r) => {
        if (!r.ok) throw new Error("Sem operador logado.");
        return (await r.json()) as Operador;
      })
      .catch((e) => {
        cache = null; // permite nova tentativa após falha transitória
        throw e;
      });
  }
  return cache;
}
