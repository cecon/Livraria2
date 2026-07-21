// Indicador de sincronização com a nuvem (feature 007, FR-014). Mostra o estado
// (sincronizado / pendente / sem conexão) e permite disparar manualmente. A venda
// nunca depende disto — é só visão + gatilho.
import { useCallback, useEffect, useState } from "react";
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

  const cor =
    estado === "offline" ? "#b3261e" : pendentes > 0 || estado === "sincronizando" ? "#b8860b" : "#1a7f37";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button
        type="button"
        onClick={sincronizar}
        disabled={estado === "sincronizando"}
        title={erro ?? "Sincronizar com a nuvem"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #d0d5da",
          background: "transparent",
          borderRadius: 8,
          padding: "4px 10px",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor }} />
        <span>{rotulo}</span>
      </button>
      {erro && (
        <span style={{ color: "#b3261e", fontSize: 11, maxWidth: 180, wordBreak: "break-word" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
