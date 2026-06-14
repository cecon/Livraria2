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
  restanteCentavos: number;
}

export function PaymentRow({
  rotulo,
  Icon,
  valor,
  onChange,
  onReceberRestante,
  restanteCentavos,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground flex w-32 items-center gap-2 text-[13px]">
        <Icon size={15} />
        {rotulo}
      </div>
      <Input
        inputMode="numeric"
        placeholder="0,00"
        value={valor > 0 ? valorPos(valor) : ""}
        onChange={(e) => onChange(digitosParaCentavos(e.currentTarget.value))}
        className="h-9 flex-1 text-right font-mono"
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
