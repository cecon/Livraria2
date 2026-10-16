"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/interface/ui/button";
import { Input } from "@/interface/ui/input";
import { Label } from "@/interface/ui/label";
import { registrarAjuste } from "@/lib/nuvem/movimentos";
import { lerQtdAjuste } from "@/lib/nuvem/ajuste";

type Props = { livroUid: string; onAjustado: () => void; onRecusado?: () => void };

// Ajuste avulso de estoque com motivo (paridade com o PDV). Grava um movimento
// `ajuste` na nuvem; o saldo é recalculado pela view. A API recusa ajuste negativo
// que deixaria o saldo abaixo de zero (spec 015); aí o pai recarrega o saldo.
export function AjusteEstoque({ livroUid, onAjustado, onRecusado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aplicar() {
    if (enviando) return;
    const delta = lerQtdAjuste(qtd);
    if (delta === null) return toast.error("Informe a quantidade (ex.: -2 ou 3)");
    if (!motivo.trim()) return toast.error("Motivo é obrigatório");
    setEnviando(true);
    try {
      const { error } = await registrarAjuste(livroUid, delta, motivo.trim());
      if (error) {
        toast.error(error);
        onRecusado?.();
        return;
      }
      toast.success("Estoque ajustado");
      setAberto(false);
      setQtd("");
      setMotivo("");
      onAjustado();
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        Ajustar estoque
      </Button>
    );
  }

  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <Label className="text-xs">Qtd (±)</Label>
          <Input aria-label="Qtd (±)" value={qtd} onChange={(e) => setQtd(e.currentTarget.value)} className="mt-1 h-8 font-mono" inputMode="numeric" placeholder="-2" />
        </div>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} className="mt-1 h-8" placeholder="perda, quebra, correção…" />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => setAberto(false)}>Cancelar</Button>
        <Button type="button" size="sm" disabled={enviando} onClick={aplicar}>{enviando ? "Aplicando…" : "Aplicar"}</Button>
      </div>
    </div>
  );
}
