// Indicador de sincronização com a nuvem (feature 007, FR-014). Mostra o estado
// (sincronizado / pendente / sem conexão) e permite disparar manualmente. A venda
// nunca depende disto — é só visão + gatilho.
import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { sincronizarAgora, statusSincronizacao } from "../lib/ipc_sync";

type Estado = "sincronizado" | "pendente" | "sincronizando" | "offline";

export function SyncStatus() {
  const [pendentes, setPendentes] = useState(0);
  const [estado, setEstado] = useState<Estado>("sincronizado");
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    try {
      const s = await statusSincronizacao();
      setPendentes(s.pendentes);
      setEstado((e) => (e === "sincronizando" ? e : s.pendentes > 0 ? "pendente" : "sincronizado"));
    } catch {
      /* status é local; ignora falhas transitórias */
    }
  }, []);

  useEffect(() => {
    atualizar();
    const id = setInterval(atualizar, 20000);
    return () => clearInterval(id);
  }, [atualizar]);

  async function sincronizar() {
    setEstado("sincronizando");
    setErro(null);
    try {
      await sincronizarAgora();
      setEstado("sincronizado");
    } catch (e) {
      setEstado("offline");
      setErro(typeof e === "string" ? e : ((e as Error)?.message ?? "erro"));
    }
    atualizar();
  }

  const rotulo =
    estado === "sincronizando"
      ? "Sincronizando…"
      : estado === "offline"
        ? "Sem conexão"
        : pendentes > 0
          ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}`
          : "Sincronizado";

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={sincronizar}
        disabled={estado === "sincronizando"}
        title={erro ?? "Sincronizar com a nuvem"}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm hover:bg-brand-50 hover:text-brand disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        {estado === "offline" ? (
          <CloudOff size={16} className="text-red-600" />
        ) : (
          <RefreshCw
            size={16}
            className={`${estado === "sincronizando" ? "animate-spin" : ""} ${
              pendentes > 0 ? "text-amber-600" : "text-emerald-600"
            }`}
          />
        )}
        <span>{rotulo}</span>
      </button>
      {erro && (
        <span className="block break-words text-[11px] text-red-600">
          {erro}
        </span>
      )}
    </div>
  );
}
