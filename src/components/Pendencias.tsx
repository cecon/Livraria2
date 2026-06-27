// Lista de pendências de cadastro vindas do inventário (US5, FR-051/052).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inventarioPendencias, resolverPendencia, type ErroIpc } from "@/lib/ipc";
import type { Pendencia } from "@/lib/types";

export function Pendencias({ recarregar }: { recarregar?: number }) {
  const [itens, setItens] = useState<Pendencia[]>([]);
  const navigate = useNavigate();

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

  // "Já resolvido": dispensa a pendência sem cadastrar nada (FR-002).
  async function jaResolvido(id: number) {
    try {
      await resolverPendencia(id);
      toast.success("Pendência dispensada");
      void carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao dispensar");
    }
  }

  // "Cadastrar livro": leva ao cadastro semeando o código lido (FR-003, completo na US4).
  function cadastrar(p: Pendencia) {
    navigate("/cadastro", { state: { novoCodigo: p.codigoLido, pendenciaId: p.id } });
  }

  if (itens.length === 0) return null;

  return (
    <div className="bg-card mt-4 rounded-xl border p-5">
      <h2 className="font-medium">Pendências de cadastro</h2>
      <p className="text-muted-foreground text-xs">
        Códigos bipados que não existem no acervo. Cadastre o livro, ou marque como
        já resolvido se você já tratou esse item.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <span className="font-mono">{p.codigoLido}</span>
            <span className="text-muted-foreground">contados: {p.qtd}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => cadastrar(p)}>
                Cadastrar livro
              </Button>
              <Button size="sm" variant="ghost" onClick={() => jaResolvido(p.id)}>
                Já resolvido
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
