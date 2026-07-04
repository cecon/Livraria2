// Lista do cadastro de formas (US2): reordenar (↑/↓), ativar/desativar e
// excluir, com mensagens de bloqueio distinguindo os casos — de sistema,
// em uso, reativação com nome conflitante (o backend valida; a UI orienta).

import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  definirFormaAtiva,
  excluirForma,
  reordenarFormas,
  type ErroIpc,
} from "@/lib/ipc";
import type { FormaPagamento } from "@/lib/types";

interface Props {
  formas: FormaPagamento[];
  onMudou: () => void;
  onEditar: (f: FormaPagamento) => void;
}

export function FormasPagamentoLista({ formas, onMudou, onEditar }: Props) {
  async function mover(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= formas.length) return;
    const ids = formas.map((f) => f.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    try {
      await reordenarFormas(ids);
      onMudou();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao reordenar");
    }
  }

  async function alternarAtiva(f: FormaPagamento) {
    try {
      await definirFormaAtiva(f.id, !f.ativa);
      toast.success(`"${f.rotulo}" ${f.ativa ? "desativada" : "ativada"}`);
      onMudou();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao alterar a forma");
    }
  }

  async function excluir(f: FormaPagamento) {
    if (!window.confirm(`Excluir a forma "${f.rotulo}"?`)) return;
    try {
      await excluirForma(f.id);
      toast.success(`"${f.rotulo}" excluída`);
      onMudou();
    } catch (e) {
      // Em uso / de sistema: o backend orienta desativar em vez de excluir.
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir a forma");
    }
  }

  return (
    <div className="space-y-1">
      {formas.map((f, i) => (
        <div
          key={f.id}
          className={`bg-card flex items-center gap-2 rounded-lg border p-2 text-sm ${
            f.ativa ? "" : "opacity-60"
          }`}
        >
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={i === 0}
              title="Mover para cima"
              onClick={() => mover(i, -1)}
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={i === formas.length - 1}
              title="Mover para baixo"
              onClick={() => mover(i, 1)}
            >
              <ArrowDown size={13} />
            </Button>
          </div>
          <span className="flex-1 font-medium">{f.rotulo}</span>
          {f.deSistema && (
            <span
              className="text-muted-foreground bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase"
              title="Forma de sistema: o troco ou a importação do legado dependem dela. Pode ser renomeada e reordenada."
            >
              <Lock size={10} /> sistema
            </span>
          )}
          {!f.ativa && (
            <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
              inativa
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Renomear"
            onClick={() => onEditar(f)}
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[12px]"
            disabled={f.deSistema}
            title={
              f.deSistema
                ? "Formas de sistema não podem ser desativadas"
                : f.ativa
                  ? "Some das opções do PDV; o histórico continua"
                  : "Volta a aparecer no PDV (nome não pode conflitar com outra ativa)"
            }
            onClick={() => alternarAtiva(f)}
          >
            {f.ativa ? "Desativar" : "Ativar"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-rose-500 hover:text-rose-600"
            disabled={f.deSistema}
            title={
              f.deSistema
                ? "Formas de sistema não podem ser excluídas"
                : "Excluir (só formas nunca usadas em vendas)"
            }
            onClick={() => excluir(f)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}
