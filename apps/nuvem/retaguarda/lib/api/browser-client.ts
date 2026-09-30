const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [300, 900];

type BrowserRequestOptions = {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  fallback: string;
};

export class BrowserApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "BrowserApiError";
  }
}

export async function browserApiRequest<T>(url: string, options: BrowserRequestOptions): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const attempts = method === "GET" || method === "HEAD" ? RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
        headers: { "content-type": "application/json" },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      if (attempt + 1 < attempts) {
        await wait(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new BrowserApiError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "A resposta demorou demais. Tente novamente."
          : "Não foi possível conectar ao servidor. Tente novamente.",
      );
    }

    const result = await response.json().catch(() => ({})) as { erro?: string };
    if (response.status === 401) {
      await recoverExpiredSession();
      throw new BrowserApiError(result.erro || "Sessão expirada. Entre novamente.", 401);
    }
    if (response.ok) return result as T;
    if (TRANSIENT_STATUSES.has(response.status) && attempt + 1 < attempts) {
      await wait(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new BrowserApiError(result.erro || options.fallback, response.status);
  }

  throw new BrowserApiError(options.fallback);
}

async function recoverExpiredSession() {
  if (typeof window === "undefined") return;
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  const current = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(current)}`);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
