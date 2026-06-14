// Linha de forma de pagamento no resumo do PDV (FR-013): rótulo + input + "Receber restante".

import type { LucideIcon } from "lucide-react";
import { brl } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  rotulo: string;
  Icon: LucideIcon;
  valor: string;
  onChange: (texto: string) => void;
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
        inputMode="decimal"
        placeholder="0,00"
        value={valor}
        onChange={(e) => onChange(e.currentTarget.value)}
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
