"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  BookPlus,
  CircleDollarSign,
  FileBarChart,
  Package,
  ReceiptText,
  Search,
  type LucideIcon,
} from "lucide-react";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { dashboard, type DashboardDia, type PeriodoDash } from "@/lib/nuvem/dashboard";
import { reais } from "@/utils/texto";

const PERIODOS: { id: PeriodoDash; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7dias", rotulo: "Últimos 7 dias" },
  { id: "mes", rotulo: "Do mês" },
  { id: "ano", rotulo: "Ano" },
];

const ACOES = [
  { to: "/venda", rotulo: "Vendas dos PDVs", Icon: ReceiptText, destaque: false },
  { to: "/cadastro", rotulo: "Cadastrar Livro", Icon: BookPlus, destaque: false },
  { to: "/pesquisa", rotulo: "Pesquisar", Icon: Search, destaque: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, destaque: false },
];

// Painel de acompanhamento do escritório.
export default function Inicio() {
  const [dash, setDash] = useState<DashboardDia | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoDash>("hoje");

  useEffect(() => {
    dashboard(periodo).then(setDash).catch(() => setDash(null));
  }, [periodo]);

  const periodoRotulo = PERIODOS.find((p) => p.id === periodo)?.rotulo.toLowerCase() ?? "hoje";
  const baixoCount = dash?.estoqueBaixo.length ?? 0;
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:p-6 lg:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-kicker mb-1">Painel</div>
          <h1>Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe a operação do Espaço do Livro.</p>
        </div>
        <div className="text-muted-foreground text-sm capitalize">{hoje}</div>
      </div>

      <div className="mt-6 flex w-fit max-w-full flex-wrap gap-1 rounded-md border bg-card p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={`min-h-8 rounded px-3 py-1 text-xs font-medium transition-colors ${periodo === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat Icon={CircleDollarSign} tom="emerald" rotulo="Vendas" sub={periodoRotulo} valor={reais(dash?.vendasCentavos ?? 0)} />
        <Stat Icon={BookOpenCheck} tom="blue" rotulo="Itens vendidos" sub={periodoRotulo} valor={String(dash?.itensVendidos ?? 0)} />
        <Stat Icon={ReceiptText} tom="amber" rotulo="Ticket médio" sub={periodoRotulo} valor={reais(dash?.ticketMedioCentavos ?? 0)} />
        <Stat Icon={Package} tom="violet" rotulo="Livros / estoque" sub="atual" valor={`${dash?.totalLivros ?? 0} / ${(dash?.totalEstoque ?? 0).toLocaleString("pt-BR")}`} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACOES.map(({ to, rotulo, Icon, destaque }) => (
          <Link
            key={to}
            href={to}
            className={`flex min-h-12 items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors ${destaque ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card hover:border-primary/40 hover:bg-accent"}`}
          >
            <Icon size={18} />
            {rotulo}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="admin-panel border bg-card p-5 lg:col-span-2">
          <div className="section-kicker">Catálogo</div>
          <h2 className="mt-1 text-base font-semibold">Estoque baixo</h2>
          <div className="mt-3 space-y-2">
            {baixoCount === 0 ? (
              <div className="text-muted-foreground text-sm">Tudo em ordem.</div>
            ) : (
              dash?.estoqueBaixo.map((l) => (
                <div key={l.codigo} className="flex items-center gap-2">
                  <Cover titulo={l.titulo} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{l.titulo}</div>
                    {l.autor && <div className="text-muted-foreground truncate text-[11px]">{l.autor}</div>}
                  </div>
                  <StockBadge estoque={l.estoque} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="admin-panel border bg-card p-5">
          <div className="section-kicker">Acompanhamento</div>
          <h2 className="mt-1 text-base font-semibold">Vendas canceladas</h2>
          <p className="text-muted-foreground text-[12px] capitalize">{periodoRotulo}</p>
          <div className="mt-3">
            <div className="font-mono text-3xl font-bold text-amber-600">{dash?.canceladasQtd ?? 0}</div>
            <div className="text-muted-foreground mt-1 text-sm">venda(s) · {reais(dash?.canceladasCentavos ?? 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TONS = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

function Stat({ rotulo, valor, sub, Icon, tom }: {
  rotulo: string;
  valor: string;
  sub?: string;
  Icon: LucideIcon;
  tom: keyof typeof TONS;
}) {
  return (
    <div className="admin-panel border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-9 place-items-center rounded-md ${TONS[tom]}`}><Icon className="size-[18px]" /></span>
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-3 font-mono text-xl font-bold">{valor}</div>
      <div className="mt-1 text-[11px] font-medium uppercase text-muted-foreground">{rotulo}</div>
    </div>
  );
}
