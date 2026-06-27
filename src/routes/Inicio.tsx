// Tela Início / Dashboard (US4, FR-030/031).
// Nota (004/US6): o card "Migração / Sincronização do legado" foi removido da UI;
// o comando de backend `migrar_legado` permanece registrado (ver git para o card).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookPlus, FileBarChart, Search, ShoppingCart } from "lucide-react";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { brl } from "@/lib/format";
import { dashboardDoDia, type DashboardDia, type PeriodoDash } from "@/lib/ipc";

const PERIODOS: { id: PeriodoDash; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7dias", rotulo: "Últimos 7 dias" },
  { id: "mes", rotulo: "Do mês" },
  { id: "ano", rotulo: "Ano" },
];

const ACOES = [
  { to: "/venda", rotulo: "Nova Venda", Icon: ShoppingCart, destaque: true },
  { to: "/cadastro", rotulo: "Cadastrar Livro", Icon: BookPlus, destaque: false },
  { to: "/pesquisa", rotulo: "Pesquisar", Icon: Search, destaque: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, destaque: false },
];

export default function Inicio() {
  const [dash, setDash] = useState<DashboardDia | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoDash>("hoje");

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  function carregar() {
    dashboardDoDia(periodo).then(setDash).catch(() => setDash(null));
  }

  const periodoRotulo =
    PERIODOS.find((p) => p.id === periodo)?.rotulo.toLowerCase() ?? "hoje";

  const baixoCount = dash?.estoqueBaixo.length ?? 0;
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Espaço do Livro</h1>
          <p className="text-muted-foreground text-sm">Bem-vindo de volta.</p>
        </div>
        <div className="text-muted-foreground text-sm capitalize">{hoje}</div>
      </div>

      <div className="mt-5 flex gap-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={`rounded-md border px-3 py-1 text-xs transition-colors ${
              periodo === p.id
                ? "border-[#1f7a4d] bg-[#1f7a4d] text-white"
                : "bg-card hover:bg-muted/50"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-3">
        <Stat rotulo="Vendas" sub={periodoRotulo} valor={brl(dash?.vendasCentavos ?? 0)} />
        <Stat
          rotulo="Itens vendidos"
          sub={periodoRotulo}
          valor={String(dash?.itensVendidos ?? 0)}
        />
        <Stat
          rotulo="Ticket médio"
          sub={periodoRotulo}
          valor={brl(dash?.ticketMedioCentavos ?? 0)}
        />
        <Stat
          rotulo="Livros / estoque"
          sub="atual"
          valor={`${dash?.totalLivros ?? 0} / ${(dash?.totalEstoque ?? 0).toLocaleString("pt-BR")}`}
        />
        <Stat
          rotulo="Canceladas"
          sub={`${dash?.canceladasQtd ?? 0} venda(s) · ${periodoRotulo}`}
          valor={brl(dash?.canceladasCentavos ?? 0)}
          alerta
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        {ACOES.map(({ to, rotulo, Icon, destaque }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md ${
              destaque ? "bg-[#1f7a4d] text-white" : "bg-card"
            }`}
          >
            <Icon size={18} />
            {rotulo}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <div className="bg-card rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Estoque baixo</h2>
          <div className="mt-3 space-y-2">
            {baixoCount === 0 ? (
              <div className="text-muted-foreground text-sm">Tudo em ordem.</div>
            ) : (
              dash?.estoqueBaixo.slice(0, 8).map((l) => (
                <div key={l.codigo} className="flex items-center gap-2">
                  <Cover titulo={l.titulo} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{l.titulo}</div>
                    {l.autor && (
                      <div className="text-muted-foreground truncate text-[11px]">
                        {l.autor}
                      </div>
                    )}
                  </div>
                  <StockBadge estoque={l.estoque} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  rotulo,
  valor,
  sub,
  alerta,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[11px] uppercase">{rotulo}</span>
        {sub && <span className="text-muted-foreground text-[10px]">{sub}</span>}
      </div>
      <div
        className={`mt-1 font-mono text-xl font-bold ${alerta ? "text-amber-600" : ""}`}
      >
        {valor}
      </div>
    </div>
  );
}
