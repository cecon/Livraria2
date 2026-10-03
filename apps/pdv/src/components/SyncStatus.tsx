// Indicador de sincronização com a nuvem (feature 007, FR-014). Mostra o estado
// (sincronizado / pendente / sem conexão) e permite disparar manualmente. A venda
// nunca depende disto — é só visão + gatilho.
import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { sincronizarAgora, statusSincronizacao } from "../lib/ipc_sync";

type Estado = "sincronizado" | "pendente" | "sincronizando" | "offline";

export function SyncStatus() {
  const [imagens, setImagens] = useState(0);
  const [pendentes, setPendentes] = useState(0);
  const [estado, setEstado] = useState<Estado>("pendente");
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    try {
      const s = await statusSincronizacao();
      setPendentes(s.pendentes);
      setImagens(s.imagensPendentes ?? 0);
      setEstado((e) => (e === "sincronizando" || e === "offline" ? e : s.pendentes > 0 ? "pendente" : e));
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
      window.dispatchEvent(new Event("imagens-atualizadas"));
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
        ? "Falha ao sincronizar"
        : pendentes > 0
          ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}`
          : estado === "sincronizado" ? "Sincronizado" : "Sem envios pendentes";

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
      {imagens > 0 && <span role="status" className="block text-[11px] text-muted-foreground">{imagens} imagem(ns) aguardando download. A venda continua disponível.</span>}
      {erro && (
        <span role="alert" className="block break-words text-[11px] text-red-600">
          {erro}
        </span>
      )}
    </div>
  );
}
