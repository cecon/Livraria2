"use client";

// Inicialização única do domínio via WASM (@livraria/domain, ADR-0022).
// Mesmas regras do PDV — o Escritório NÃO reimplementa nada, só chama.
import init, * as dom from "@livraria/domain";

let pronto: Promise<typeof dom> | null = null;

export function dominio(): Promise<typeof dom> {
  if (!pronto) pronto = init().then(() => dom);
  return pronto;
}
