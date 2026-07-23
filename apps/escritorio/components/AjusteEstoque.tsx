"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { registrarAjuste } from "@/lib/nuvem/movimentos";

// Ajuste avulso de estoque com motivo (paridade com o PDV). Grava um movimento
// `ajuste` na nuvem; o saldo é recalculado pela view.
export function AjusteEstoque({ livroUid, onAjustado }: { livroUid: string; onAjustado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");

  async function aplicar() {
    const delta = parseInt(qtd, 10);
    if (!delta || Number.isNaN(delta)) return toast.error("Informe a quantidade (ex.: -2 ou 3)");
    if (!motivo.trim()) return toast.error("Motivo é obrigatório");
    const { error } = await registrarAjuste(livroUid, delta, motivo.trim());
    if (error) return toast.error(error);
    toast.success("Estoque ajustado");
    setAberto(false);
    setQtd("");
    setMotivo("");
    onAjustado();
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
          <Input value={qtd} onChange={(e) => setQtd(e.currentTarget.value)} className="mt-1 h-8 font-mono" placeholder="-2" />
        </div>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} className="mt-1 h-8" placeholder="perda, quebra, correção…" />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
        <Button size="sm" onClick={aplicar}>Aplicar</Button>
      </div>
    </div>
  );
}
