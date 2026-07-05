// Lista do cadastro de destinações (US3): reordenar (↑/↓, só as livres — a
// ordem é a ordem de baixa dos carimbos na venda), ativar/desativar e excluir.
// "Loja" é a destinação de sistema: fixa no topo, renomeável apenas.

import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  destinacaoDefinirAtiva,
  destinacaoExcluir,
  destinacaoReordenar,
  type ErroIpc,
} from "@/lib/ipc";
import type { Destinacao } from "@/lib/types";

interface Props {
  destinacoes: Destinacao[];
  onMudou: () => void;
  onEditar: (d: Destinacao) => void;
}

export function DestinacoesLista({ destinacoes, onMudou, onEditar }: Props) {
  const livres = destinacoes.filter((d) => !d.deSistema);

  async function mover(d: Destinacao, delta: number) {
    const i = livres.findIndex((x) => x.id === d.id);
    const destino = i + delta;
    if (i < 0 || destino < 0 || destino >= livres.length) return;
    const ids = livres.map((x) => x.id);
    [ids[i], ids[destino]] = [ids[destino], ids[i]];
    try {
      await destinacaoReordenar(ids);
      onMudou();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao reordenar");
    }
  }

  async function alternarAtiva(d: Destinacao) {
    try {
      await destinacaoDefinirAtiva(d.id, !d.ativa);
      toast.success(`"${d.nome}" ${d.ativa ? "desativada" : "ativada"}`);
      onMudou();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao alterar a destinação");
    }
  }

  async function excluir(d: Destinacao) {
    if (!window.confirm(`Excluir a destinação "${d.nome}"?`)) return;
    try {
      await destinacaoExcluir(d.id);
      toast.success(`"${d.nome}" excluída`);
      onMudou();
    } catch (e) {
      // Em uso / de sistema: o backend orienta desativar em vez de excluir.
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir a destinação");
    }
  }

  return (
    <div className="space-y-1">
      {destinacoes.map((d) => {
        const iLivre = livres.findIndex((x) => x.id === d.id);
        return (
          <div
            key={d.id}
            className={`bg-card flex items-center gap-2 rounded-lg border p-2 text-sm ${
              d.ativa ? "" : "opacity-60"
            }`}
          >
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-6"
                disabled={d.deSistema || iLivre === 0}
                title="Mover para cima (a ordem é a ordem de baixa na venda)"
                onClick={() => mover(d, -1)}
              >
                <ArrowUp size={13} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-6"
                disabled={d.deSistema || iLivre === livres.length - 1}
                title="Mover para baixo"
                onClick={() => mover(d, 1)}
              >
                <ArrowDown size={13} />
              </Button>
            </div>
            <span className="flex-1 font-medium">{d.nome}</span>
            {d.deSistema && (
              <span
                className="text-muted-foreground bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase"
                title="Destinação padrão do sistema: o saldo livre pertence a ela e ela é sempre a primeira na ordem de baixa. Pode ser renomeada."
              >
                <Lock size={10} /> sistema
              </span>
            )}
            {!d.ativa && (
              <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
                inativa
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Renomear"
              onClick={() => onEditar(d)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              disabled={d.deSistema}
              title={
                d.deSistema
                  ? "A Loja não pode ser desativada"
                  : d.ativa
                    ? "Some das opções de transferência; saldos existentes continuam valendo"
                    : "Volta a aceitar transferências (nome não pode conflitar com outra ativa)"
              }
              onClick={() => alternarAtiva(d)}
            >
              {d.ativa ? "Desativar" : "Ativar"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-500 hover:text-rose-600"
              disabled={d.deSistema}
              title={
                d.deSistema
                  ? "A Loja não pode ser excluída"
                  : "Excluir (só destinações nunca usadas)"
              }
              onClick={() => excluir(d)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
