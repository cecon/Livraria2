// Identidade do turno no cabeçalho do PDV (feature 013, FR-021): mostra SEMPRE
// o PC e, havendo turno aberto, quem o abriu. Sem turno, diz isso com todas as
// letras — o operador nunca fica em dúvida sobre em que turno está vendendo.

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { maquinaNome, turnoAberto, type TurnoAberto } from "@/lib/ipc";

/** Recarrega junto com o resto da barra: abrir/encerrar turno reflete aqui. */
const INTERVALO_MS = 15_000;

export function IdentidadeTurno() {
  const [maquina, setMaquina] = useState("");
  const [turno, setTurno] = useState<TurnoAberto | null>(null);

  useEffect(() => {
    let vivo = true;
    maquinaNome()
      .then((m) => vivo && setMaquina(m))
      .catch(() => vivo && setMaquina(""));
    const ler = () =>
      turnoAberto()
        .then((t) => vivo && setTurno(t))
        .catch(() => vivo && setTurno(null));
    ler();
    const id = setInterval(ler, INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-3 mb-2 rounded-lg bg-zinc-800/60 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <Monitor size={13} />
        <span className="truncate font-mono">{maquina || "PDV"}</span>
      </div>
      <div className="mt-0.5 text-[12px]">
        {turno ? (
          <span className="text-zinc-200">
            Turno de <span className="font-medium">{turno.operador || "—"}</span>
          </span>
        ) : (
          <span className="text-amber-400">Sem turno aberto</span>
        )}
      </div>
    </div>
  );
}
