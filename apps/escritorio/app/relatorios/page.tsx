"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@livraria/ui/ui/table";
import { relatorios, type Linha } from "@/lib/nuvem/relatorios";
import { reais } from "@/utils/texto";
import { Carregando, Vazio } from "@/components/estados";

// Relatórios (US2/T031) — total por forma de pagamento e repasse por destinação.
export default function RelatoriosPage() {
  const [dados, setDados] = useState<{ pagamentos: Linha[]; destinacoes: Linha[] } | null>(null);

  useEffect(() => {
    relatorios().then(setDados);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Relatórios</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Por forma de pagamento</h2>
        <div className="mt-3">
          {dados === null ? <Carregando /> : <TabelaTotais linhas={dados.pagamentos} />}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Repasse por destinação</h2>
        <div className="mt-3">
          {dados === null ? <Carregando /> : <TabelaTotais linhas={dados.destinacoes} />}
        </div>
      </section>
    </main>
  );
}

function TabelaTotais({ linhas }: { linhas: Linha[] }) {
  if (linhas.length === 0) return <Vazio texto="Nada sincronizado ainda." />;
  const total = linhas.reduce((s, l) => s + l.total, 0);
  return (
    <Table>
      <TableBody>
        {linhas.map((l) => (
          <TableRow key={l.rotulo}>
            <TableCell>{l.rotulo}</TableCell>
            <TableCell className="text-right">{reais(l.total)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{reais(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
