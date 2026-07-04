// Cadastro de formas de pagamento (US2, FR-005..011): criar, renomear,
// reordenar, ativar/desativar e excluir. O efeito reflete no PDV e relatórios.

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormaPagamentoForm } from "@/components/FormaPagamentoForm";
import { FormasPagamentoLista } from "@/components/FormasPagamentoLista";
import { listarFormas } from "@/lib/ipc";
import type { FormaPagamento } from "@/lib/types";

export default function FormasPagamento() {
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [editando, setEditando] = useState<FormaPagamento | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      setFormas(await listarFormas());
    } catch {
      setFormas([]);
    }
  }

  function fecharForm() {
    setCriando(false);
    setEditando(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Formas de pagamento
          </h1>
          <p className="text-muted-foreground text-sm">
            A ordem daqui vale para o PDV e os relatórios. Formas com o selo
            “sistema” podem ser renomeadas, mas não excluídas nem desativadas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setCriando(true);
          }}
          className="h-9"
        >
          <Plus size={15} /> Nova forma
        </Button>
      </div>

      {(criando || editando) && (
        <FormaPagamentoForm
          forma={editando}
          onSalvo={() => {
            fecharForm();
            carregar();
          }}
          onCancelar={fecharForm}
        />
      )}

      {formas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma forma cadastrada.
        </p>
      ) : (
        <FormasPagamentoLista
          formas={formas}
          onMudou={carregar}
          onEditar={(f) => {
            setCriando(false);
            setEditando(f);
          }}
        />
      )}
    </div>
  );
}
