// Criar/renomear destinação (US3, FR-001/FR-002). Erros de duplicata
// normalizada ("missoes" = "Missões") chegam do backend com mensagem clara.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinacaoCriar, destinacaoRenomear, type ErroIpc } from "@/lib/ipc";
import type { Destinacao } from "@/lib/types";

interface Props {
  /** Destinação em edição (renomear) ou null para criar. */
  destinacao: Destinacao | null;
  onSalvo: () => void;
  onCancelar: () => void;
}

export function DestinacaoForm({ destinacao, onSalvo, onCancelar }: Props) {
  const [nome, setNome] = useState(destinacao?.nome ?? "");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setNome(destinacao?.nome ?? "");
  }, [destinacao]);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome da destinação");
      return;
    }
    setOcupado(true);
    try {
      if (destinacao) {
        await destinacaoRenomear(destinacao.id, nome);
        toast.success(`Destinação renomeada para "${nome.trim()}"`);
      } else {
        await destinacaoCriar(nome);
        toast.success(`Destinação "${nome.trim()}" criada`);
      }
      onSalvo();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao salvar a destinação");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="text-sm font-medium">
        {destinacao ? `Renomear "${destinacao.nome}"` : "Nova destinação"}
      </div>
      <div>
        <Label htmlFor="nome-destinacao">Nome</Label>
        <Input
          id="nome-destinacao"
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder="Ex.: Missões"
          className="mt-1 h-9"
          autoFocus
        />
        {destinacao?.deSistema && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            Destinação de sistema: pode ser renomeada, mas não excluída nem
            desativada — o saldo livre de todo livro pertence a ela.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={ocupado} className="h-9">
          {destinacao ? "Renomear" : "Criar"}
        </Button>
        <Button variant="ghost" onClick={onCancelar} className="h-9">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
