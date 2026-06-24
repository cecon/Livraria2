// Ajuste avulso de estoque com motivo (US3, FR-040..043).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarAjuste, type ErroIpc } from "@/lib/ipc";
import type { Livro } from "@/lib/types";

export function AjusteEstoque({
  livro,
  onAjustado,
}: {
  livro: Livro;
  onAjustado: (l: Livro) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");

  async function aplicar() {
    const delta = parseInt(qtd, 10);
    if (!delta || Number.isNaN(delta)) {
      toast.error("Informe a quantidade (ex.: -2 ou 3)");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Motivo é obrigatório");
      return;
    }
    try {
      const atualizado = await registrarAjuste(livro.codigo, delta, motivo.trim());
      toast.success(`Estoque ajustado para ${atualizado.estoque}`);
      setAberto(false);
      setQtd("");
      setMotivo("");
      onAjustado(atualizado);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao ajustar");
    }
  }

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        Ajustar estoque
      </Button>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <Label className="text-xs">Qtd (±)</Label>
          <Input
            value={qtd}
            onChange={(e) => setQtd(e.currentTarget.value)}
            className="mt-1 h-8 font-mono"
            placeholder="-2"
          />
        </div>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            className="mt-1 h-8"
            placeholder="perda, quebra, correção…"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={aplicar}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}
