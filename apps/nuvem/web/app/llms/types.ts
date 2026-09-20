export type Llm = {
  uid: string; nome: string; provedor: "openai-compatible" | "google";
  endereco: string; modelo: string; ativo: boolean; pdv: boolean; retaguarda: boolean;
  versao: number; possuiCredencial: boolean;
};
export const addresses = { "openai-compatible": "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta" };

export async function request(path = "", body?: unknown, method = "POST") {
  const response = await fetch(`/api/llms${path}`, { cache: "no-store",
    ...(body !== undefined && { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a operação.");
  return data;
}
