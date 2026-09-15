let mode: Promise<boolean> | undefined;

export function stockApiEnabled() {
  mode ??= fetch("/api/estoque/config", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error("Configuracao do estoque indisponivel");
      const result = await response.json();
      if (typeof result.enabled !== "boolean") throw new Error("Configuracao invalida");
      return result.enabled as boolean;
    }).catch(error => { mode = undefined; throw error; });
  return mode;
}

export async function stockRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/estoque${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Estoque indisponivel");
  return result;
}
