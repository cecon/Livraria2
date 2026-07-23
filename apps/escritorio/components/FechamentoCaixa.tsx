"use client";

// Fechamento de caixa (feature 009, US1) — conferência SÓ do dinheiro (clarify Q1):
// totais por forma são informativos; o operador confere a contagem física do
// dinheiro; a diferença é registrada e NÃO impede o encerramento.
import { useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { brl, parseBRLInput } from "@/lib/brl";
import type { ResumoTurno } from "@/lib/nuvem/turno";

export function FechamentoCaixa({
  resumo,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  resumo: ResumoTurno;
  ocupado: boolean;
  onConfirmar: (conferidoCentavos: number) => void;
  onCancelar: () => void;
}) {
  const [conferido, setConferido] = useState("");
  const conferidoCentavos = parseBRLInput(conferido);
  const diferenca = conferidoCentavos - resumo.esperadoDinheiroCentavos;

  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      <div className="text-sm font-medium">Fechamento de caixa</div>

      <div className="space-y-1">
        <div className="text-muted-foreground text-xs uppercase">Totais por forma (informativo)</div>
        {resumo.porForma.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma venda no turno.</p>
        ) : (
          resumo.porForma.map((f) => (
            <div key={f.rotulo} className="flex justify-between text-sm">
              <span>{f.rotulo}</span>
              <span className="tabular-nums">{brl(f.centavos)}</span>
            </div>
          ))
        )}
        <div className="text-muted-foreground flex justify-between border-t pt-1 text-xs">
          <span>Vendas no turno</span>
          <span className="tabular-nums">{resumo.qtdVendas}</span>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Dinheiro esperado (caixa inicial + vendas em dinheiro)</span>
          <span className="tabular-nums font-medium">{brl(resumo.esperadoDinheiroCentavos)}</span>
        </div>
        <div>
          <Label htmlFor="conferido">Dinheiro conferido (contagem física)</Label>
          <Input
            id="conferido"
            value={conferido}
            onChange={(e) => setConferido(e.currentTarget.value)}
            placeholder="R$ 0,00"
            inputMode="decimal"
            className="mt-1 h-9"
            autoFocus
          />
        </div>
        {conferido.trim() !== "" && (
          <div className={`flex justify-between text-sm ${diferenca === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            <span>{diferenca === 0 ? "Confere" : diferenca > 0 ? "Sobra" : "Falta"}</span>
            <span className="tabular-nums font-medium">{brl(Math.abs(diferenca))}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onConfirmar(conferidoCentavos)} disabled={ocupado} className="h-9">
          Encerrar turno
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={ocupado} className="h-9">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
