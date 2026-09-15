let mode: Promise<boolean> | undefined;

export function entriesApiEnabled() {
  mode ??= fetch("/api/lancamentos/config", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error("Configuracao de lancamentos indisponivel");
      const result = await response.json();
      if (typeof result.enabled !== "boolean") throw new Error("Configuracao invalida");
      return result.enabled as boolean;
    }).catch(error => { mode = undefined; throw error; });
  return mode;
}

export async function entriesRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/lancamentos${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Lancamentos indisponiveis");
  return result;
}
