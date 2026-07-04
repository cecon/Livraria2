// Criar/renomear forma de pagamento (US2, FR-005/006). Erros de duplicata
// normalizada ("credito" = "Crédito") chegam do backend com mensagem clara.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarForma, renomearForma, type ErroIpc } from "@/lib/ipc";
import type { FormaPagamento } from "@/lib/types";

interface Props {
  /** Forma em edição (renomear) ou null para criar. */
  forma: FormaPagamento | null;
  onSalvo: () => void;
  onCancelar: () => void;
}

export function FormaPagamentoForm({ forma, onSalvo, onCancelar }: Props) {
  const [rotulo, setRotulo] = useState(forma?.rotulo ?? "");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setRotulo(forma?.rotulo ?? "");
  }, [forma]);

  async function salvar() {
    if (!rotulo.trim()) {
      toast.error("Informe o nome da forma de pagamento");
      return;
    }
    setOcupado(true);
    try {
      if (forma) {
        await renomearForma(forma.id, rotulo);
        toast.success(`Forma renomeada para "${rotulo.trim()}"`);
      } else {
        await criarForma(rotulo, true);
        toast.success(`Forma "${rotulo.trim()}" criada`);
      }
      onSalvo();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao salvar a forma");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="text-sm font-medium">
        {forma ? `Renomear "${forma.rotulo}"` : "Nova forma de pagamento"}
      </div>
      <div>
        <Label htmlFor="rotulo-forma">Nome</Label>
        <Input
          id="rotulo-forma"
          value={rotulo}
          onChange={(e) => setRotulo(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder="Ex.: Boleto"
          className="mt-1 h-9"
          autoFocus
        />
        {forma?.deSistema && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            Forma de sistema: pode ser renomeada, mas não excluída nem desativada.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={ocupado} className="h-9">
          {forma ? "Renomear" : "Criar"}
        </Button>
        <Button variant="ghost" onClick={onCancelar} className="h-9">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
