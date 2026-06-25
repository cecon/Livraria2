// Editor de uma nota de entrada (US2/US4): fornecedor + itens (EntradaProduto) +
// dar entrada. Rascunho é editável; finalizada é somente leitura.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntradaProduto } from "@/components/EntradaProduto";
import { FornecedorSelect } from "@/components/FornecedorSelect";
import { ItensNotaTabela } from "@/components/ItensNotaTabela";
import { brl, digitosParaCentavos, valorPos } from "@/lib/format";
import {
  buscarPorCodigoBarras,
  lancamentoAdicionarItem,
  lancamentoCancelar,
  lancamentoDefinirFornecedor,
  lancamentoExcluir,
  lancamentoFinalizar,
  lancamentoObter,
  lancamentoRemoverItem,
  type ErroIpc,
} from "@/lib/ipc";
import type { LancamentoDetalhe } from "@/lib/types";

export function LancamentoEditor({ id, onFechar }: { id: number; onFechar: () => void }) {
  const [nota, setNota] = useState<LancamentoDetalhe | null>(null);
  const [qtd, setQtd] = useState("1");
  const [codigo, setCodigo] = useState("");
  const [pendente, setPendente] = useState<{ codigo: string; titulo: string } | null>(null);
  const [modoCusto, setModoCusto] = useState<"unit" | "total">("unit");
  const [custo, setCusto] = useState("");
  const codigoRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  async function recarregar() {
    setNota(await lancamentoObter(id));
  }

  useEffect(() => {
    void recarregar();
  }, [id]);

  const lendo = nota !== null && nota.status !== "rascunho";

  async function cancelar() {
    if (
      !window.confirm(
        "Cancelar este lançamento? O estoque dos itens será ESTORNADO (revertido). " +
          "Use isto para corrigir um lançamento errado.",
      )
    ) {
      return;
    }
    try {
      await lancamentoCancelar(id);
      toast.success("Lançamento cancelado — estoque estornado");
      onFechar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao cancelar");
    }
  }

  // Seleciona o livro (não adiciona ainda) — o custo/qtd são preenchidos depois.
  function escolherLivro(cod: string, titulo: string) {
    const c = cod.trim();
    if (!c) return;
    setPendente({ codigo: c, titulo });
    setCodigo("");
    // Fluxo por teclado: foca o custo logo após escolher o livro.
    setTimeout(() => custoRef.current?.focus(), 0);
  }

  // Enter num código digitado/bipado: resolve no acervo; texto solto não vira item.
  async function resolverCodigo(valor: string) {
    const v = valor.trim();
    if (!v) return;
    try {
      const l = await buscarPorCodigoBarras(v);
      if (l) escolherLivro(l.codigo, l.titulo);
      else toast.error(`"${v}" não encontrado no acervo`);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
    }
  }

  async function adicionar() {
    if (!pendente || !nota) return;
    const q = parseInt(qtd, 10);
    if (!q || q <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    const centavos = digitosParaCentavos(custo);
    if (centavos <= 0) {
      toast.error("Informe o custo (total ou unitário)");
      return;
    }
    try {
      setNota(
        await lancamentoAdicionarItem(
          id,
          pendente.codigo,
          q,
          modoCusto === "total" ? centavos : undefined,
          modoCusto === "unit" ? centavos : undefined,
        ),
      );
      setPendente(null);
      setCusto("");
      setQtd("1");
      codigoRef.current?.focus();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao adicionar item");
    }
  }

  async function escolherFornecedor(fid: number, nome: string) {
    try {
      await lancamentoDefinirFornecedor(id, fid, nota?.numero ?? undefined);
      setNota((n) => (n ? { ...n, fornecedorId: fid, fornecedorNome: nome } : n));
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao definir fornecedor");
    }
  }

  async function remover(itemId: number) {
    try {
      setNota(await lancamentoRemoverItem(id, itemId));
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao remover");
    }
  }

  async function darEntrada() {
    try {
      await lancamentoFinalizar(id);
      toast.success("Entrada registrada — estoque atualizado");
      onFechar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao dar entrada");
    }
  }

  async function excluir() {
    if (!window.confirm("Excluir este rascunho? Nada será lançado no estoque.")) return;
    try {
      await lancamentoExcluir(id);
      toast.info("Rascunho excluído");
      onFechar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir");
    }
  }

  if (!nota) return null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {nota.status === "rascunho"
            ? `Lançamento #${nota.id}`
            : nota.status === "cancelada"
              ? `Nota #${nota.id} (cancelada)`
              : `Nota #${nota.id} (finalizada)`}
        </h1>
        <Button variant="ghost" onClick={onFechar}>
          ← Voltar
        </Button>
      </div>

      <div className="bg-card mt-4 grid grid-cols-2 gap-4 rounded-xl border p-5">
        <div>
          <Label>Fornecedor</Label>
          {lendo ? (
            <div className="mt-1 h-9 leading-9">{nota.fornecedorNome ?? "—"}</div>
          ) : (
            <FornecedorSelect
              selecionadoNome={nota.fornecedorNome}
              onSelect={(f) => escolherFornecedor(f.id, f.nome)}
            />
          )}
        </div>
        <div>
          <Label>Número da nota (opcional)</Label>
          <Input
            value={nota.numero ?? ""}
            disabled={lendo}
            onChange={(e) => setNota({ ...nota, numero: e.currentTarget.value })}
            onBlur={() =>
              nota.fornecedorId &&
              lancamentoDefinirFornecedor(id, nota.fornecedorId, nota.numero ?? undefined)
            }
            className="mt-1 h-9"
          />
        </div>
      </div>

      {!lendo && (
        <div className="bg-card mt-4 rounded-xl border p-5">
          <Label>Adicionar item</Label>
          <div className="mt-1">
            <EntradaProduto
              value={codigo}
              onChange={setCodigo}
              inputRef={codigoRef}
              onCodigoExato={() => void resolverCodigo(codigo)}
              onSelecionar={(l) => escolherLivro(l.codigo, l.titulo)}
            />
          </div>
          {pendente && (
            <div className="mt-3 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground text-[11px]">Livro</span>
                <div className="truncate font-medium">{pendente.titulo}</div>
              </div>
              <div className="w-16">
                <span className="text-muted-foreground text-[11px]">Qtd</span>
                <Input
                  value={qtd}
                  onChange={(e) => setQtd(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && custoRef.current?.focus()}
                  inputMode="numeric"
                  className="h-9 text-center font-mono"
                />
              </div>
              <select
                value={modoCusto}
                onChange={(e) => setModoCusto(e.currentTarget.value as "unit" | "total")}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              >
                <option value="unit">Unit.</option>
                <option value="total">Total</option>
              </select>
              <div className="w-28">
                <span className="text-muted-foreground text-[11px]">Custo (R$)</span>
                <Input
                  ref={custoRef}
                  value={custo}
                  onChange={(e) => {
                    const d = digitosParaCentavos(e.currentTarget.value);
                    setCusto(d > 0 ? valorPos(d) : "");
                  }}
                  onKeyDown={(e) => {
                    // "*" (maquininha): manda os dígitos para a quantidade e limpa o custo.
                    if (e.key === "*") {
                      e.preventDefault();
                      const q = digitosParaCentavos(custo);
                      if (q > 0) {
                        setQtd(String(q));
                        setCusto("");
                      }
                    } else if (e.key === "Enter") {
                      adicionar();
                    }
                  }}
                  inputMode="numeric"
                  placeholder="0,00"
                  className="h-9 text-right font-mono"
                />
              </div>
              <Button onClick={adicionar} className="h-9">
                Adicionar
              </Button>
            </div>
          )}
        </div>
      )}

      <ItensNotaTabela itens={nota.itens} lendo={lendo} onRemover={remover} />

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-lg font-bold">Total: {brl(nota.totalCentavos)}</span>
        {nota.status === "rascunho" && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={excluir} className="text-rose-500 hover:text-rose-600">
              Excluir rascunho
            </Button>
            <Button onClick={darEntrada} className="bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">
              Dar entrada
            </Button>
          </div>
        )}
        {nota.status === "finalizada" && (
          <Button variant="outline" onClick={cancelar} className="text-rose-600 hover:text-rose-700">
            Cancelar lançamento (estornar)
          </Button>
        )}
      </div>
    </div>
  );
}
