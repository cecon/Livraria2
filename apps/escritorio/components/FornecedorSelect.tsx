"use client";

import { useMemo, useState } from "react";
import { Input } from "@livraria/ui/ui/input";
import type { Fornecedor } from "@/lib/nuvem/fornecedor";

export function FornecedorSelect({ fornecedores, selecionadoNome, onSelect }: { fornecedores: Fornecedor[]; selecionadoNome?: string | null; onSelect: (f: Fornecedor) => void }) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const resultados = useMemo(() => {
    const q = termo.trim().toLowerCase();
    return (q ? fornecedores.filter((f) => f.nome.toLowerCase().includes(q)) : fornecedores).slice(0, 30);
  }, [fornecedores, termo]);

  return (
    <div className="relative">
      <Input
        value={aberto ? termo : selecionadoNome ?? ""}
        placeholder="Escolha o fornecedor…"
        onFocus={() => {
          setAberto(true);
          setTermo("");
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={(e) => setTermo(e.currentTarget.value)}
        className="h-9"
      />
      {aberto && resultados.length > 0 && (
        <div className="bg-popover absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border shadow-lg">
          {resultados.map((f) => (
            <button key={f.sync_uid} onMouseDown={() => { onSelect(f); setAberto(false); }} className="hover:bg-muted/60 block w-full border-b px-3 py-2 text-left text-sm last:border-b-0">
              <div className="truncate font-medium">{f.nome}</div>
              {f.telefone && <div className="text-muted-foreground truncate text-[11px]">{f.telefone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
