import type { EntradaLivro, Livro } from "@/lib/nuvem/livro";
import { browserApiRequest } from "./browser-client";

export async function catalogRequest(path: string, method = "GET", body?: unknown) {
  return browserApiRequest<any>(`/api/catalogo${path}`, {
    method, body, fallback: "Catálogo indisponível",
  });
}

export async function listApiBooks(incluirInativos = false): Promise<Livro[]> {
  const books: Livro[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams();
    if (after) params.set("after", after);
    if (incluirInativos) params.set("inativos", "1");
    const result = await catalogRequest(params.size ? `?${params}` : "");
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
