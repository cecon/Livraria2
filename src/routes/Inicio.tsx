// Tela Início (US4). Por ora: atalho e card de Migração/Sincronização do legado.

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { migrarLegado, type ErroIpc, type RelatorioMigracao } from "@/lib/ipc";

export default function Inicio() {
  const [caminho, setCaminho] = useState("../Livraria/livraria.mdb");
  const [ocupado, setOcupado] = useState(false);
  const [rel, setRel] = useState<RelatorioMigracao | null>(null);

  async function sincronizar() {
    setOcupado(true);
    try {
      const r = await migrarLegado(caminho.trim() || undefined);
      setRel(r);
      toast.success(
        `Migração: ${r.livrosImportados} livros, ${r.pedidosInseridos} pedidos novos`,
      );
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na migração");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Dashboard completo em construção (US4).
      </p>

      <div className="bg-card mt-6 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Migração / Sincronização do legado</h2>
        <p className="text-muted-foreground mt-1 text-[13px]">
          Importa o acervo e as vendas do Access. Idempotente — pode rodar quantas
          vezes quiser durante a transição.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={caminho}
            onChange={(e) => setCaminho(e.currentTarget.value)}
            className="h-9 font-mono text-[13px]"
            placeholder="Caminho do .mdb"
          />
          <Button onClick={sincronizar} disabled={ocupado} className="h-9 shrink-0">
            <RefreshCw size={15} className={ocupado ? "animate-spin" : ""} />
            Sincronizar
          </Button>
        </div>

        {rel && (
          <div className="mt-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Stat rotulo="Livros" valor={rel.livrosImportados} />
              <Stat rotulo="Pedidos novos" valor={rel.pedidosInseridos} />
              <Stat rotulo="Já existentes" valor={rel.pedidosExistentes} />
            </div>
            {rel.divergencias.length > 0 && (
              <details className="mt-3">
                <summary className="text-amber-600">
                  {rel.divergencias.length} divergência(s) registrada(s)
                </summary>
                <ul className="text-muted-foreground mt-1 max-h-40 overflow-auto text-[12px]">
                  {rel.divergencias.slice(0, 50).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <div className="font-mono text-xl font-bold">{valor}</div>
      <div className="text-muted-foreground text-[11px] uppercase">{rotulo}</div>
    </div>
  );
}
