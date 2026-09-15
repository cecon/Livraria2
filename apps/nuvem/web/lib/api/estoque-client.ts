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
