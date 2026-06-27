// Lista de pendências de cadastro vindas do inventário (US2/US4/US5).
// Ativas: "Cadastrar livro" (semeia o código) ou "Já resolvido" (dispensa).
// Resolvidas: consultáveis e reabríveis (FR-006/FR-007).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  inventarioPendencias,
  reabrirPendencia,
  resolverPendencia,
  type ErroIpc,
} from "@/lib/ipc";
import type { Pendencia } from "@/lib/types";

export function Pendencias({ recarregar }: { recarregar?: number }) {
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [resolvidas, setResolvidas] = useState<Pendencia[]>([]);
  const [verResolvidas, setVerResolvidas] = useState(false);
  const navigate = useNavigate();

  async function carregar() {
    try {
      const todas = await inventarioPendencias(false); // todas (ativas + resolvidas)
      setItens(todas.filter((p) => !p.resolvida));
      setResolvidas(todas.filter((p) => p.resolvida));
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    void carregar();
  }, [recarregar]);

  async function jaResolvido(id: number) {
    try {
      await resolverPendencia(id);
      toast.success("Pendência dispensada");
      void carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao dispensar");
    }
  }

  async function reabrir(id: number) {
    try {
      await reabrirPendencia(id);
      toast.success("Pendência reaberta");
      void carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao reabrir");
    }
  }

  function cadastrar(p: Pendencia) {
    navigate("/cadastro", { state: { novoCodigo: p.codigoLido, pendenciaId: p.id } });
  }

  if (itens.length === 0 && resolvidas.length === 0) return null;

  return (
    <div className="bg-card mt-4 rounded-xl border p-5">
      <h2 className="font-medium">Pendências de cadastro</h2>
      <p className="text-muted-foreground text-xs">
        Códigos bipados que não existem no acervo. Cadastre o livro, ou marque como
        já resolvido se você já tratou esse item.
      </p>

      {itens.length > 0 && (
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
      )}

      {resolvidas.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setVerResolvidas((v) => !v)}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            {verResolvidas ? "ocultar" : "ver"} resolvidas ({resolvidas.length})
          </button>
          {verResolvidas && (
            <ul className="mt-2 space-y-2">
              {resolvidas.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground font-mono">{p.codigoLido}</span>
                  <span className="text-muted-foreground">contados: {p.qtd}</span>
                  <Button size="sm" variant="ghost" onClick={() => reabrir(p.id)}>
                    Reabrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
