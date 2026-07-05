// Cadastro de destinações (US3, FR-001..005): criar, renomear, reordenar,
// ativar/desativar e excluir. A ordem define a ordem de baixa dos carimbos
// na venda ("Loja" sempre primeira); o destino do estoque é definido na
// lista de livros do Cadastro (ícone de destinação).

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestinacaoForm } from "@/components/DestinacaoForm";
import { DestinacoesLista } from "@/components/DestinacoesLista";
import { destinacoesListar } from "@/lib/ipc";
import type { Destinacao } from "@/lib/types";

export default function Destinacoes() {
  const [destinacoes, setDestinacoes] = useState<Destinacao[]>([]);
  const [editando, setEditando] = useState<Destinacao | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      setDestinacoes(await destinacoesListar());
    } catch {
      setDestinacoes([]);
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
          <h1 className="text-xl font-semibold tracking-tight">Destinações</h1>
          <p className="text-muted-foreground text-sm">
            Para onde vai o valor das vendas de livros doados. A ordem daqui é
            a ordem de baixa na venda; o saldo livre pertence à “Loja”. Carimbe
            os livros no Cadastro, pelo ícone de destinação na lista.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setCriando(true);
          }}
          className="h-9"
        >
          <Plus size={15} /> Nova destinação
        </Button>
      </div>

      {(criando || editando) && (
        <DestinacaoForm
          destinacao={editando}
          onSalvo={() => {
            fecharForm();
            carregar();
          }}
          onCancelar={fecharForm}
        />
      )}

      {destinacoes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <DestinacoesLista
          destinacoes={destinacoes}
          onMudou={carregar}
          onEditar={(d) => {
            setCriando(false);
            setEditando(d);
          }}
        />
      )}
    </div>
  );
}
