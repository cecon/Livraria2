"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { registrarAjuste, validarAjuste } from "@/lib/nuvem/movimentos";
import { lerQtdAjuste, mensagemAjuste } from "@/lib/nuvem/ajuste_erro";

type Props = {
  livroUid: string;
  saldoAtual: number;
  onAjustado: () => void;
  onSaldoAtualizado?: (saldo: number) => void;
};

// Ajuste manual de estoque com motivo (Cadastro e Pesquisa). Valida pela regra do
// domínio (ADR-0026) antes de enviar; a nuvem grava um movimento `ajuste` e
// recusa saldo negativo também do lado dela (venda/ajuste concorrente).
export function AjusteEstoque({ livroUid, saldoAtual, onAjustado, onSaldoAtualizado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aplicar() {
    if (enviando) return;
    const delta = lerQtdAjuste(qtd);
    if (delta === null) return toast.error(mensagemAjuste("AJUSTE_SEM_QUANTIDADE"));
    setEnviando(true);
    try {
      const valido = await validarAjuste(saldoAtual, delta, motivo);
      if (valido.error) return toast.error(valido.error);
      const { error, saldoAtual: saldoNuvem } = await registrarAjuste(livroUid, delta, motivo.trim());
      if (error) {
        if (saldoNuvem !== undefined && saldoNuvem !== saldoAtual) onSaldoAtualizado?.(saldoNuvem);
        return toast.error(error);
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
    <div className="bg-muted/30 w-full rounded-lg border p-3">
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <Label className="text-xs">Qtd (±)</Label>
          <Input
            value={qtd}
            onChange={(e) => setQtd(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), aplicar())}
            className="mt-1 h-8 font-mono"
            inputMode="numeric"
            placeholder="-2"
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), aplicar())}
            className="mt-1 h-8"
            placeholder="perda, quebra, correção…"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={enviando} onClick={aplicar}>
          {enviando ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
