import type { EntradaForma, Forma } from "@/lib/nuvem/forma";
import type { EntradaFornecedor, Fornecedor } from "@/lib/nuvem/fornecedor";

let mode: Promise<boolean> | undefined;
export function referencesApiEnabled() {
  mode ??= fetch("/api/referencias/config", { cache: "no-store", signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error("Configuracao de referencias indisponivel");
      const result = await response.json();
      if (typeof result.enabled !== "boolean") throw new Error("Configuracao invalida");
      return result.enabled as boolean;
    }).catch(error => { mode = undefined; throw error; });
  return mode;
}

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/referencias${path}`, { method, cache: "no-store",
    signal: AbortSignal.timeout(10000), headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Referencias indisponiveis");
  return result;
}

async function listAll<T>(resource: string) {
  const items: T[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result = await request(`/${resource}${after ? `?after=${encodeURIComponent(after)}` : ""}`);
    if (!Array.isArray(result.items)) throw new Error("Pagina de referencias invalida");
    items.push(...result.items);
    if (result.next === null) return items;
    if (typeof result.next !== "string" || seen.has(result.next)) throw new Error("Cursor de referencias invalido");
    seen.add(result.next); after = result.next;
  }
  throw new Error("Referencias excedem limite desta consulta");
}

export async function listApiForms() {
  return (await listAll<Forma>("formas")).sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
export async function listApiSuppliers() {
  return (await listAll<Fornecedor>("fornecedores")).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
async function result(operation: () => Promise<unknown>) {
  try { await operation(); return {}; }
  catch (error) { return { error: error instanceof Error ? error.message : "Falha no cadastro" }; }
}
export function saveApiForm(input: EntradaForma) {
  const id = input.sync_uid || crypto.randomUUID();
  return result(() => request(`/formas${input.sync_uid ? `/${id}` : ""}`,
    input.sync_uid ? "PUT" : "POST", { ...input, sync_uid: id }));
}
export const setApiFormActive = (id: string, ativa: boolean) =>
  result(() => request(`/formas/${id}/ativa`, "PUT", { ativa }));
export const deleteApiForm = (id: string) => result(() => request(`/formas/${id}`, "DELETE"));
export const reorderApiForms = (forms: Forma[]) =>
  result(() => request("/formas/reordenar", "PUT", { uids: forms.map(form => form.sync_uid) }));
export function saveApiSupplier(input: EntradaFornecedor) {
  const id = input.sync_uid || crypto.randomUUID();
  return result(() => request(`/fornecedores${input.sync_uid ? `/${id}` : ""}`,
    input.sync_uid ? "PUT" : "POST", { ...input, sync_uid: id }));
}
export const deleteApiSupplier = (id: string) => result(() => request(`/fornecedores/${id}`, "DELETE"));
