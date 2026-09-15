export async function salesRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/vendas${path}`, { method, cache: "no-store",
    signal: AbortSignal.timeout(15000), headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Vendas indisponiveis");
  return result;
}
