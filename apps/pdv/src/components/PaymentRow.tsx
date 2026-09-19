// Linha de forma de pagamento (FR-013). Input estilo maquininha: digita só os
// números e as 2 casas decimais entram da direita para a esquerda.

import type { LucideIcon } from "lucide-react";
import { brl, digitosParaCentavos, valorPos } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  rotulo: string;
  Icon: LucideIcon;
  valor: number; // centavos
  onChange: (centavos: number) => void;
  onReceberRestante: () => void;
  onReceberVenda: () => void;
  podeReceberVenda: boolean;
  restanteCentavos: number;
  inputRef: (elemento: HTMLInputElement | null) => void;
  onNavigate: (direcao: -1 | 1) => void;
}

export function PaymentRow({
  rotulo,
  Icon,
  valor,
  onChange,
  onReceberRestante,
  onReceberVenda,
  podeReceberVenda,
  restanteCentavos,
  inputRef,
  onNavigate,
}: Props) {
  return (
    <div className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 transition-colors focus-within:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-400 dark:focus-within:bg-brand-500/15">
      <div className="text-muted-foreground flex w-32 items-center gap-2 text-[13px]">
        <Icon size={15} />
        {rotulo}
      </div>
      <Input
        ref={inputRef}
        aria-label={`Pagamento em ${rotulo}`}
        inputMode="numeric"
        placeholder="0,00"
        value={valor > 0 ? valorPos(valor) : ""}
        onChange={(e) => onChange(digitosParaCentavos(e.currentTarget.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (valor === 0 && restanteCentavos > 0) {
              const campo = e.currentTarget;
              onReceberRestante();
              requestAnimationFrame(() => campo.select());
            } else if (restanteCentavos === 0 && podeReceberVenda) {
              onReceberVenda();
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            onChange(0);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            onNavigate(e.key === "ArrowDown" ? 1 : -1);
          }
        }}
        className="h-9 flex-1 text-right font-mono focus-visible:border-input focus-visible:ring-0"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={restanteCentavos <= 0}
        onClick={onReceberRestante}
        className="h-9 shrink-0 font-mono text-[12px]"
        title={`Receber ${brl(restanteCentavos)} nesta forma`}
      >
        {brl(restanteCentavos)}
      </Button>
    </div>
  );
}
