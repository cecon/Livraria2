"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, EyeOff, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@livraria/ui/ui/button";
import {
  ignorarDivergenciaEstoque,
  listarDivergenciasEstoque,
  resolverDivergenciaEstoque,
  type DivergenciaEstoque,
} from "@/lib/nuvem/estoque";

const ROTULO_TIPO: Record<DivergenciaEstoque["tipo"], string> = {
  saldo_negativo: "Saldo negativo",
  produto_inativo: "Produto inativo",
  venda_invalida: "Venda invalida",
  processamento_estoque: "Processamento",
};

export default function DivergenciasEstoquePage() {
  const [itens, setItens] = useState<DivergenciaEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setItens(await listarDivergenciasEstoque());
    } catch {
      toast.error("Falha ao carregar divergencias de estoque.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function agir(syncUid: string, acao: "resolver" | "ignorar") {
    setOcupado(syncUid);
    const r =
      acao === "resolver"
        ? await resolverDivergenciaEstoque(syncUid)
        : await ignorarDivergenciaEstoque(syncUid);
    setOcupado(null);
    if (r.error) return toast.error(r.error);
    toast.success(acao === "resolver" ? "Divergencia resolvida." : "Divergencia ignorada.");
    await carregar();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <AlertTriangle size={20} /> Divergencias de estoque
          </h1>
          <p className="text-muted-foreground text-sm">
            Revise alertas gerados pela automacao oficial de estoque na nuvem.
          </p>
        </div>
        <Button variant="outline" onClick={carregar} disabled={carregando} className="h-9">
          <RotateCw size={16} />
          Atualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-2 text-left font-medium">Tipo</th>
              <th className="p-2 text-left font-medium">Descricao</th>
              <th className="p-2 text-right font-medium">Saldo antes</th>
              <th className="p-2 text-right font-medium">Qtd</th>
              <th className="p-2 text-right font-medium">Criada em</th>
              <th className="p-2 text-right font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((d) => (
              <tr key={d.sync_uid} className="border-t">
                <td className="p-2">{ROTULO_TIPO[d.tipo]}</td>
                <td className="p-2">{d.descricao || "-"}</td>
                <td className="p-2 text-right font-mono">{d.saldo_antes ?? "-"}</td>
                <td className="p-2 text-right font-mono">{d.qtd_evento ?? "-"}</td>
                <td className="text-muted-foreground p-2 text-right text-xs">
                  {d.criado_em.slice(0, 10).split("-").reverse().join("/")}
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ocupado === d.sync_uid}
                      onClick={() => agir(d.sync_uid, "ignorar")}
                    >
                      <EyeOff size={14} />
                      Ignorar
                    </Button>
                    <Button size="sm" disabled={ocupado === d.sync_uid} onClick={() => agir(d.sync_uid, "resolver")}>
                      <Check size={14} />
                      Resolver
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && itens.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-8 text-center">
                  Nenhuma divergencia aberta.
                </td>
              </tr>
            )}
            {carregando && (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-8 text-center">
                  Carregando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
