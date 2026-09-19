import type { ComponentProps } from "react";
import { Input } from "@livraria/ui/wowdash/input";
import { brl } from "@/lib/format";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  centavos: number;
  onCentavosChange: (centavos: number) => void;
};

export function ValorCentavosInput({ centavos, onCentavosChange, ...props }: Props) {
  return <Input {...props} type="text" inputMode="numeric" value={brl(centavos)}
    onChange={(event) => {
      const digitos = event.currentTarget.value.replace(/\D/g, "").replace(/^0+/, "");
      const proximo = digitos ? Number(digitos) : 0;
      if (Number.isSafeInteger(proximo)) onCentavosChange(proximo);
    }} />;
}
