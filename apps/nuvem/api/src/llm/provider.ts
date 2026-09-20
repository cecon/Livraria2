import { endpoint, Provider } from "./validation";

export interface ProbeResult { ok: boolean; mensagem: string; codigo: string }

export async function probe(config: { provedor: Provider; endereco: string; modelo: string }, secret: string | null): Promise<ProbeResult> {
  const base = endpoint(config.endereco, config.provedor);
  const google = config.provedor === "google";
  const model = google ? config.modelo.replace(/^models\//, "") : config.modelo;
  const headers: Record<string, string> = { accept: "application/json" };
  if (secret) headers[google ? "x-goog-api-key" : "authorization"] = google ? secret : `Bearer ${secret}`;
  try {
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}`, {
      headers, redirect: "error", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const message = response.status === 401 || response.status === 403 ? "Credencial recusada pelo provedor."
        : response.status === 404 ? "Modelo não encontrado ou indisponível para esta credencial."
        : response.status === 429 ? "Limite do provedor atingido. Tente novamente mais tarde."
        : "Provedor indisponível. Tente novamente.";
      return { ok: false, codigo: `HTTP_${response.status}`, mensagem: message };
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 65536) { await reader.cancel(); throw new Error(); }
      chunks.push(next.value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if ((google ? data.name : data.id) !== (google ? `models/${model}` : model)) {
      return { ok: false, codigo: "RESPOSTA_INVALIDA", mensagem: "O provedor não confirmou o modelo informado." };
    }
    return { ok: true, codigo: "OK", mensagem: "Conexão e acesso ao modelo confirmados. Nenhum conteúdo foi gerado." };
  } catch {
    return { ok: false, codigo: "CONEXAO", mensagem: "Não foi possível validar a conexão no tempo esperado. Confira o endereço e tente novamente." };
  }
}
