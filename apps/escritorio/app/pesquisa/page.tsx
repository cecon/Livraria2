"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@livraria/ui/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarLivros, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos, movimentosDoLivro } from "@/lib/nuvem/estoque";
import { dominio } from "@/lib/dominio";
import { reais } from "@/utils/texto";
import { Carregando, Vazio } from "@/components/estados";

type Detalhe = { livro: Livro; saldo: number; custo: number };

// Pesquisa — estoque & preço (US2/T026). Saldo pela view; custo médio pelo
// MESMO domínio do PDV via WASM (@livraria/domain).
export default function PesquisaPage() {
  const [livros, setLivros] = useState<Livro[] | null>(null);
  const [saldos, setSaldos] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Detalhe | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    (async () => {
      const [ls, ss] = await Promise.all([listarLivros(), listarSaldos()]);
      setLivros(ls);
      setSaldos(ss);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const base = livros ?? [];
    const q = busca.trim().toLowerCase();
    const lista = q
      ? base.filter((l) => `${l.codigo} ${l.titulo} ${l.autor ?? ""}`.toLowerCase().includes(q))
      : base;
    return lista.slice(0, 100);
  }, [livros, busca]);

  async function detalhar(l: Livro) {
    setCalculando(true);
    try {
      const [movs, dom] = await Promise.all([movimentosDoLivro(l.sync_uid), dominio()]);
      const r = dom.recompor_ledger(movs) as { saldo: number; custo_medio_centavos: number };
      setSel({ livro: l, saldo: r.saldo, custo: r.custo_medio_centavos });
    } finally {
      setCalculando(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Pesquisa — estoque &amp; preço</h1>

      <Input
        className="mt-4 max-w-md"
        placeholder="Buscar por código, título ou autor…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {sel && (
        <div className="mt-4 rounded-lg border p-4 text-sm">
          <div className="font-medium">{sel.livro.titulo}</div>
          <div className="mt-1 flex flex-wrap gap-6 text-muted-foreground">
            <span>
              Preço: <strong className="text-foreground">{reais(sel.livro.preco_centavos)}</strong>
            </span>
            <span>
              Saldo: <strong className="text-foreground">{sel.saldo}</strong>
            </span>
            <span>
              Custo médio: <strong className="text-foreground">{reais(sel.custo)}</strong>{" "}
              <span className="text-xs">(via domínio/WASM)</span>
            </span>
          </div>
        </div>
      )}
      {calculando && <p className="mt-2 text-xs text-muted-foreground">Calculando custo médio…</p>}

      <div className="mt-4">
        {livros === null ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio texto="Nenhum livro encontrado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((l) => (
                <TableRow key={l.sync_uid} className="cursor-pointer" onClick={() => detalhar(l)}>
                  <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                  <TableCell>{l.titulo}</TableCell>
                  <TableCell className="text-right">{saldos.get(l.sync_uid) ?? 0}</TableCell>
                  <TableCell className="text-right">{reais(l.preco_centavos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
