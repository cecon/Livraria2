// Seleção de fornecedor com busca (US2). Combobox simples sobre fornecedoresListar.

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { fornecedoresListar } from "@/lib/ipc";
import type { Fornecedor } from "@/lib/types";

interface Props {
  selecionadoNome?: string | null;
  onSelect: (f: Fornecedor) => void;
}

export function FornecedorSelect({ selecionadoNome, onSelect }: Props) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Fornecedor[]>([]);
  const [aberto, setAberto] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!aberto) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        setResultados(await fornecedoresListar(termo.trim()));
      } catch {
        setResultados([]);
      }
    }, 160);
    return () => window.clearTimeout(timer.current);
  }, [termo, aberto]);

  return (
    <div className="relative">
      <Input
        value={aberto ? termo : (selecionadoNome ?? "")}
        placeholder="Escolha o fornecedor…"
        onFocus={() => {
          setAberto(true);
          setTermo("");
        }}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onChange={(e) => setTermo(e.currentTarget.value)}
        className="h-9"
      />
      {aberto && resultados.length > 0 && (
        <div className="bg-popover absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border shadow-lg">
          {resultados.map((f) => (
            <button
              key={f.id}
              onMouseDown={() => {
                onSelect(f);
                setAberto(false);
              }}
              className="hover:bg-muted/60 block w-full border-b px-3 py-2 text-left text-sm last:border-b-0"
            >
              <div className="truncate font-medium">{f.nome}</div>
              {f.telefone && (
                <div className="text-muted-foreground truncate text-[11px]">{f.telefone}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
