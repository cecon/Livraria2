"use client";

// Contagem de inventário (feature 009, US3) — seletor de modo (parcial/total) e
// bip por código/título (reusa EntradaProduto), com lista contada (+1/−1/remover).
import type { RefObject } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { EntradaProduto, type LivroBusca } from "@/components/EntradaProduto";
import type { ModoInventario } from "@/lib/nuvem/inventario";

export type ItemContado = { livroUid: string; codigo: string; titulo: string; contado: number };

export function ContagemInventario({
  modo,
  onModo,
  busca,
  onBusca,
  livros,
  onBip,
  inputRef,
  itens,
  onQtd,
  onRemover,
}: {
  modo: ModoInventario;
  onModo: (m: ModoInventario) => void;
  busca: string;
  onBusca: (v: string) => void;
  livros: LivroBusca[];
  onBip: (l: LivroBusca) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  itens: ItemContado[];
  onQtd: (livroUid: string, delta: number) => void;
  onRemover: (livroUid: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Modo:</span>
        <div className="flex gap-1">
          <ModoBtn ativo={modo === "parcial"} onClick={() => onModo("parcial")}>Parcial</ModoBtn>
          <ModoBtn ativo={modo === "total"} onClick={() => onModo("total")}>Total</ModoBtn>
        </div>
        <span className="text-muted-foreground text-[11px]">
          {modo === "parcial" ? "ajusta só os contados" : "não-contados contam 0"}
        </span>
      </div>

      <EntradaProduto value={busca} onChange={onBusca} onSelecionar={onBip} onCodigoExato={() => {}} inputRef={inputRef} livros={livros} />

      <div className="bg-card rounded-lg border p-3">
        {itens.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nada contado ainda. Bipe um item acima.</p>
        ) : (
          <div className="divide-y">
            {itens.map((it) => (
              <div key={it.livroUid} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{it.titulo}</div>
                  <div className="text-muted-foreground truncate font-mono text-[11px]">{it.codigo}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onQtd(it.livroUid, -1)} title="Menos">
                  <Minus size={14} />
                </Button>
                <span className="w-8 text-center tabular-nums text-sm">{it.contado}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onQtd(it.livroUid, 1)} title="Mais">
                  <Plus size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => onRemover(it.livroUid)} title="Remover">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModoBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1 text-sm ${ativo ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}>
      {children}
    </button>
  );
}
