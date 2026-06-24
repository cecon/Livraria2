// Tela de Entrada de mercadoria (compra) — US1, FR-010..015.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StockBadge } from "@/components/StockBadge";
import { brl, parseBrlParaCentavos } from "@/lib/format";
import type { Livro } from "@/lib/types";
import {
  buscarPorCodigoBarras,
  fornecedoresSugestoes,
  registrarEntrada,
  type ErroIpc,
} from "@/lib/ipc";

export default function Entrada() {
  const [busca, setBusca] = useState("");
  const [livro, setLivro] = useState<Livro | null>(null);
  const [qtd, setQtd] = useState("1");
  const [fornecedor, setFornecedor] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [modoCusto, setModoCusto] = useState<"unit" | "total">("unit");
  const [custo, setCusto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fornecedoresSugestoes("").then(setSugestoes).catch(() => {});
  }, []);

  async function localizar() {
    const v = busca.trim();
    if (!v) return;
    try {
      const l = await buscarPorCodigoBarras(v);
      if (!l) {
        toast.error("Livro não encontrado — cadastre-o antes de dar entrada");
        return;
      }
      setLivro(l);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na busca");
    }
  }

  async function confirmar() {
    if (!livro) return;
    const q = parseInt(qtd, 10);
    if (!q || q <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    const centavos = parseBrlParaCentavos(custo);
    if (centavos === null || centavos < 0) {
      toast.error("Informe o custo (total ou unitário)");
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await registrarEntrada({
        codigo: livro.codigo,
        qtd: q,
        fornecedor: fornecedor.trim(),
        custoTotalCentavos: modoCusto === "total" ? centavos : null,
        custoUnitCentavos: modoCusto === "unit" ? centavos : null,
      });
      toast.success(
        `Entrada registrada: +${q} un. — estoque ${atualizado.estoque}, ` +
          `custo médio ${brl(atualizado.custoMedioCentavos ?? 0)}`,
      );
      setLivro(null);
      setBusca("");
      setQtd("1");
      setCusto("");
      if (fornecedor.trim() && !sugestoes.includes(fornecedor.trim())) {
        setSugestoes((s) => [...s, fornecedor.trim()]);
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao registrar entrada");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Entrada de Mercadoria</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Registra a compra de livros, sobe o estoque e atualiza o custo médio.
      </p>

      <div className="bg-card mt-4 rounded-xl border p-5">
        <Label>Código de barras ou código interno</Label>
        <div className="mt-1 flex gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && localizar()}
            className="h-9 font-mono"
            placeholder="Bipe ou digite o código"
            autoFocus
          />
          <Button onClick={localizar} className="h-9">
            Localizar
          </Button>
        </div>
      </div>

      {livro && (
        <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{livro.titulo}</div>
              {livro.autor && (
                <div className="text-muted-foreground text-sm">{livro.autor}</div>
              )}
            </div>
            <StockBadge estoque={livro.estoque} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade recebida</Label>
              <Input
                type="number"
                min={1}
                value={qtd}
                onChange={(e) => setQtd(e.currentTarget.value)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                list="fornecedores"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.currentTarget.value)}
                className="mt-1 h-9"
                placeholder="Ex.: Editora X"
              />
              <datalist id="fornecedores">
                {sugestoes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <Label>Custo</Label>
            <div className="mt-1 flex gap-2">
              <select
                value={modoCusto}
                onChange={(e) =>
                  setModoCusto(e.currentTarget.value as "unit" | "total")
                }
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              >
                <option value="unit">Unitário</option>
                <option value="total">Total</option>
              </select>
              <Input
                value={custo}
                onChange={(e) => setCusto(e.currentTarget.value)}
                className="h-9 font-mono"
                placeholder="R$ 0,00"
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {modoCusto === "unit"
                ? "Preço de compra de 1 exemplar."
                : "Custo total da compra deste livro (dividido pela quantidade)."}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLivro(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={salvando}>
              {salvando ? "Registrando…" : "Registrar entrada"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
