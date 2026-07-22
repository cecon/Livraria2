"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/ui/select";
import { refsParaEntrada, registrarEntrada, type LivroRef, type FornecedorRef } from "@/lib/nuvem/lancamento";
import { centavos } from "@/utils/texto";

// Lançamentos — receber livros (US2/T027). Escreve nota + item + movimento de
// entrada na nuvem; o PDV reflete ao sincronizar.
export default function LancamentosPage() {
  const [livros, setLivros] = useState<LivroRef[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorRef[]>([]);
  const [codigo, setCodigo] = useState("");
  const [fornUid, setFornUid] = useState("");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    refsParaEntrada().then((r) => {
      setLivros(r.livros);
      setFornecedores(r.fornecedores);
    });
  }, []);

  const mapaCodigo = useMemo(() => {
    const m = new Map<string, LivroRef>();
    for (const l of livros) m.set(l.codigo, l);
    return m;
  }, [livros]);
  const livroSel = mapaCodigo.get(codigo.trim());

  async function receber(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    const q = parseInt(qtd, 10);
    if (!livroSel) {
      setErro("Código de barras não encontrado no acervo.");
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setErro("Informe uma quantidade válida.");
      return;
    }
    setSalvando(true);
    const { error } = await registrarEntrada({
      livroUid: livroSel.sync_uid,
      fornecedorUid: fornUid || null,
      qtd: q,
      custoCentavos: centavos(custo),
    });
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setMsg(`Entrada de ${q} de “${livroSel.titulo}” registrada. O PDV refletirá ao sincronizar.`);
    setCodigo("");
    setQtd("");
    setCusto("");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Lançamentos — receber livros</h1>

      <form onSubmit={receber} className="mt-6 grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="codigo">Código de barras</Label>
          <Input id="codigo" placeholder="Escaneie ou digite…" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {codigo.trim() ? (livroSel ? `✓ ${livroSel.titulo}` : "Livro não encontrado no acervo.") : " "}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Fornecedor (opcional)</Label>
          <Select value={fornUid} onValueChange={setFornUid}>
            <SelectTrigger>
              <SelectValue placeholder="— nenhum —" />
            </SelectTrigger>
            <SelectContent>
              {fornecedores.map((f) => (
                <SelectItem key={f.sync_uid} value={f.sync_uid}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="qtd">Quantidade</Label>
            <Input id="qtd" type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="custo">Custo unitário (R$)</Label>
            <Input id="custo" inputMode="decimal" placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} />
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {msg && <p className="text-sm text-[#1a7f37]">{msg}</p>}
        <div>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Registrar entrada"}
          </Button>
        </div>
      </form>
    </main>
  );
}
