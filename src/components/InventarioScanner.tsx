// Card de bipagem do inventário: UM campo (código, título ou autor) com
// autosearch — igual ao PDV (EntradaProduto). Toggle "Desfazer (−1)". US2 FR-021/022.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EntradaProduto } from "@/components/EntradaProduto";
import {
  inventarioBipar,
  inventarioDesbipar,
  type ErroIpc,
} from "@/lib/ipc";
import type { Livro } from "@/lib/types";

interface Props {
  sessaoId: number;
  onConta: () => void;
  onPendencia: () => void;
}

export function InventarioScanner({ sessaoId, onConta, onPendencia }: Props) {
  const [codigo, setCodigo] = useState("");
  const [desfazer, setDesfazer] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  async function aplicarLeitura(v: string) {
    if (!v) return;
    try {
      const r = desfazer
        ? await inventarioDesbipar(sessaoId, v)
        : await inventarioBipar(sessaoId, v);
      if (r.encontrado) {
        toast.success(
          `${r.livro?.titulo} — ${desfazer ? "desfeito" : "contado"} (${r.qtdContada})`,
        );
        onConta();
      } else if (desfazer) {
        toast.error(`"${v}" não encontrado`);
      } else {
        toast.warning(`Código ${v} desconhecido → pendência`);
        onPendencia();
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao contar");
    } finally {
      setCodigo("");
      scanRef.current?.focus();
    }
  }

  return (
    <div
      className={`mt-4 rounded-xl border p-5 ${
        desfazer ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "bg-card"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <Label>
          {desfazer ? "DESFAZER (−1) — bipe ou busque" : "Contar (+1) — bipe ou busque"}
        </Label>
        <Button
          type="button"
          size="sm"
          variant={desfazer ? "default" : "outline"}
          onClick={() => {
            setDesfazer((d) => !d);
            scanRef.current?.focus();
          }}
        >
          {desfazer ? "Modo desfazer ON" : "Desfazer (−)"}
        </Button>
      </div>
      <EntradaProduto
        value={codigo}
        onChange={setCodigo}
        inputRef={scanRef}
        onCodigoExato={() => void aplicarLeitura(codigo.trim())}
        onSelecionar={(l: Livro) => void aplicarLeitura(l.codigo)}
      />
      {desfazer && (
        <p className="mt-1 text-xs text-red-600">
          Cada leitura remove 1 da contagem. Se zerar, o livro sai da contagem.
        </p>
      )}
    </div>
  );
}
