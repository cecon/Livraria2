import { endpoint, Provider } from "./validation";

export interface ProbeResult { ok: boolean; mensagem: string; codigo: string }

export async function probe(config: { provedor: Provider; endereco: string; modelo: string }, secret: string | null): Promise<ProbeResult> {
  const base = endpoint(config.endereco, config.provedor);
  const google = config.provedor === "google";
  const openrouter = base === "https://openrouter.ai/api/v1";
  const model = google ? config.modelo.replace(/^models\//, "") : config.modelo;
  const headers: Record<string, string> = { accept: "application/json" };
  if (secret) headers[google ? "x-goog-api-key" : "authorization"] = google ? secret : `Bearer ${secret}`;
  try {
    const signal = AbortSignal.timeout(3000);
    if (openrouter) {
      // Model metadata is public: authenticate separately before claiming success.
      const auth = await fetch(`${base}/key`, { headers, redirect: "error", signal });
      await auth.body?.cancel();
      if (!auth.ok) return { ok: false, codigo: `HTTP_${auth.status}`, mensagem: "Não foi possível validar a credencial no OpenRouter." };
    }
    const path = openrouter ? `model/${model.split("/").map(encodeURIComponent).join("/")}`
      : `models/${encodeURIComponent(model)}`;
    const response = await fetch(`${base}/${path}`, {
      headers, redirect: "error", signal,
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
    if ((google ? data.name : openrouter ? data.data?.id : data.id) !== (google ? `models/${model}` : model)) {
      return { ok: false, codigo: "RESPOSTA_INVALIDA", mensagem: "O provedor não confirmou o modelo informado." };
    }
    return { ok: true, codigo: "OK", mensagem: openrouter
      ? "Credencial validada e modelo encontrado no catálogo. Nenhum conteúdo foi gerado."
      : "Conexão e acesso ao modelo confirmados. Nenhum conteúdo foi gerado." };
  } catch {
    return { ok: false, codigo: "CONEXAO", mensagem: "Não foi possível validar a conexão no tempo esperado. Confira o endereço e tente novamente." };
  }
}
