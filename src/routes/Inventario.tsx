// Tela de Inventário por bipagem (US2, FR-020..030). O card de bipagem/busca
// vive em InventarioScanner; aqui ficam a sessão e a revisão.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pendencias } from "@/components/Pendencias";
import { InventarioScanner } from "@/components/InventarioScanner";
import {
  inventarioAbrir,
  inventarioCancelar,
  inventarioFechar,
  inventarioRevisao,
  inventarioSessaoAberta,
  type ErroIpc,
} from "@/lib/ipc";
import type { Divergencia, Sessao } from "@/lib/types";

export default function Inventario() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [modo, setModo] = useState<"parcial" | "total">("parcial");
  const [rotulo, setRotulo] = useState("");
  const [linhas, setLinhas] = useState<Divergencia[]>([]);
  const [pend, setPend] = useState(0);

  useEffect(() => {
    inventarioSessaoAberta().then(setSessao).catch(() => {});
  }, []);

  useEffect(() => {
    if (sessao) void atualizar();
  }, [sessao]);

  async function atualizar() {
    if (!sessao) return;
    try {
      setLinhas(await inventarioRevisao(sessao.id));
    } catch {
      /* silencioso */
    }
  }

  async function abrir() {
    try {
      const s = await inventarioAbrir(modo, rotulo.trim() || undefined);
      setSessao(s);
      toast.success(`Sessão ${modo} aberta`);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao abrir sessão");
    }
  }

  async function fechar() {
    if (!sessao) return;
    const total = sessao.modo === "total";
    if (
      total &&
      !window.confirm(
        "Modo TOTAL: livros não bipados serão ZERADOS. Confirmar fechamento?",
      )
    ) {
      return;
    }
    try {
      const f = await inventarioFechar(sessao.id, total);
      toast.success(
        f.totalDiferencas === 0
          ? "Inventário fechado — nenhuma divergência"
          : `Inventário fechado — ${f.totalDiferencas} livro(s) ajustado(s)`,
      );
      setSessao(null);
      setLinhas([]);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao fechar");
    }
  }

  async function cancelar() {
    if (!sessao || !window.confirm("Cancelar a sessão? Nada será ajustado.")) return;
    try {
      await inventarioCancelar(sessao.id);
      toast.info("Sessão cancelada");
      setSessao(null);
      setLinhas([]);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao cancelar");
    }
  }

  if (!sessao) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inventário</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conte o acervo bipando os livros. Parcial ajusta só o que for contado;
          total zera os não bipados.
        </p>
        <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Modo</Label>
              <select
                value={modo}
                onChange={(e) => setModo(e.currentTarget.value as "parcial" | "total")}
                className="border-input bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="parcial">Parcial (ex.: uma gaveta)</option>
                <option value="total">Total (acervo inteiro)</option>
              </select>
            </div>
            <div>
              <Label>Local / rótulo</Label>
              <Input
                value={rotulo}
                onChange={(e) => setRotulo(e.currentTarget.value)}
                className="mt-1 h-9"
                placeholder="Ex.: Gaveta A"
                disabled={modo === "total"}
              />
            </div>
          </div>
          <Button onClick={abrir}>Abrir sessão</Button>
        </div>
        <Pendencias recarregar={pend} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inventário {sessao.modo === "total" ? "total" : "parcial"}
          </h1>
          {sessao.rotulo && (
            <div className="text-muted-foreground text-sm">{sessao.rotulo}</div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={cancelar}>
            Cancelar
          </Button>
          <Button onClick={fechar}>Fechar e ajustar</Button>
        </div>
      </div>

      <InventarioScanner
        sessaoId={sessao.id}
        onConta={atualizar}
        onPendencia={() => setPend((n) => n + 1)}
      />

      <div className="mt-4">
        <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
          <span>Contagem ({linhas.length} livro(s))</span>
          <button onClick={atualizar} className="hover:text-foreground underline">
            atualizar
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-medium">Livro</th>
                <th className="p-2 text-right font-medium">Sistema</th>
                <th className="p-2 text-right font-medium">Contado</th>
                <th className="p-2 text-right font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className="border-t">
                  <td className="p-2">{l.titulo}</td>
                  <td className="p-2 text-right font-mono">{l.qtdSistema}</td>
                  <td className="p-2 text-right font-mono">{l.qtdContada}</td>
                  <td
                    className={`p-2 text-right font-mono ${
                      l.diferenca === 0
                        ? "text-muted-foreground"
                        : l.diferenca > 0
                          ? "text-emerald-600"
                          : "text-red-600"
                    }`}
                  >
                    {l.diferenca > 0 ? `+${l.diferenca}` : l.diferenca}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground p-4 text-center">
                    Bipe os livros para começar a contagem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FR-005: pendências acionáveis também DURANTE a sessão aberta. */}
      <Pendencias recarregar={pend} />
    </div>
  );
}
