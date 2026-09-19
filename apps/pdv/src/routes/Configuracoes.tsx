import { useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import type { MachineState } from "@/lib/ipc_machine";
import { sincronizarAgora } from "@/lib/ipc_sync";

export default function Configuracoes({ machine }: { machine: MachineState }) {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState("");

  async function sincronizar() {
    setOcupado(true);
    setResultado("");
    try {
      const data = await sincronizarAgora();
      setResultado(`${data.enviados} enviados · ${data.recebidos} recebidos`);
    } catch (error) {
      setResultado(typeof error === "string" ? error : "Não foi possível sincronizar.");
    } finally { setOcupado(false); }
  }

  return <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
    <h1 className="flex items-center gap-2 text-xl font-semibold"><Settings size={20} /> Configurações</h1>
    <section className="space-y-4 border-t pt-5">
      <div><h2 className="text-sm font-semibold">Máquina</h2><p className="mt-1 text-sm text-muted-foreground">{machine.nome || "PDV configurado"}</p></div>
      <Button type="button" variant="outline" onClick={() => void sincronizar()} disabled={ocupado}>
        <RefreshCw className={ocupado ? "animate-spin" : ""} /> Sincronizar agora
      </Button>
      {resultado ? <p role="status" className="text-sm text-muted-foreground">{resultado}</p> : null}
    </section>
  </div>;
}
