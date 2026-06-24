// Lista de pendências de cadastro vindas do inventário (US5, FR-051/052).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inventarioPendencias, resolverPendencia, type ErroIpc } from "@/lib/ipc";
import type { Pendencia } from "@/lib/types";

export function Pendencias({ recarregar }: { recarregar?: number }) {
  const [itens, setItens] = useState<Pendencia[]>([]);

  async function carregar() {
    try {
      setItens(await inventarioPendencias(true));
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    void carregar();
  }, [recarregar]);

  async function resolver(id: number) {
    try {
      await resolverPendencia(id);
      toast.success("Pendência resolvida");
      void carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao resolver");
    }
  }

  if (itens.length === 0) return null;

  return (
    <div className="bg-card mt-4 rounded-xl border p-5">
      <h2 className="font-medium">Pendências de cadastro</h2>
      <p className="text-muted-foreground text-xs">
        Códigos bipados que não existem no acervo. Cadastre o livro e marque como resolvido.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <span className="font-mono">{p.codigoLido}</span>
            <span className="text-muted-foreground">contados: {p.qtd}</span>
            <Button size="sm" variant="ghost" onClick={() => resolver(p.id)}>
              Resolver
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
