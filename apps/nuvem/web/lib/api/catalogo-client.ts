import type { EntradaLivro, Livro } from "@/lib/nuvem/livro";

export async function catalogRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/catalogo${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.erro || "Catalogo indisponivel");
  return result;
}

export async function listApiBooks(): Promise<Livro[]> {
  const books: Livro[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result = await catalogRequest(after ? `?after=${encodeURIComponent(after)}` : "");
    if (!Array.isArray(result.items)) throw new Error("Pagina de catalogo invalida");
    books.push(...result.items);
    if (result.next === null) return books.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    if (typeof result.next !== "string" || seen.has(result.next)) throw new Error("Cursor de catalogo invalido");
    seen.add(result.next);
    after = result.next;
  }
  throw new Error("Catalogo excede limite desta consulta");
}

export async function saveApiBook(input: EntradaLivro): Promise<{ error?: string }> {
  const id = input.sync_uid || crypto.randomUUID();
  try {
    await catalogRequest(input.sync_uid ? `/${id}` : "", input.sync_uid ? "PUT" : "POST", { ...input, sync_uid: id });
    return {};
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha no cadastro" }; }
}
