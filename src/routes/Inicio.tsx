// Tela Início / Dashboard (US4, FR-030/031) + card de Migração do legado.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import {
  BookPlus,
  FileBarChart,
  FolderOpen,
  RefreshCw,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/StockBadge";
import { Cover } from "@/components/Cover";
import { brl } from "@/lib/format";
import {
  dashboardDoDia,
  migrarLegado,
  type DashboardDia,
  type ErroIpc,
  type PeriodoDash,
  type RelatorioMigracao,
} from "@/lib/ipc";

const PERIODOS: { id: PeriodoDash; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7dias", rotulo: "Últimos 7 dias" },
  { id: "mes", rotulo: "Do mês" },
];

const ACOES = [
  { to: "/venda", rotulo: "Nova Venda", Icon: ShoppingCart, destaque: true },
  { to: "/cadastro", rotulo: "Cadastrar Livro", Icon: BookPlus, destaque: false },
  { to: "/pesquisa", rotulo: "Pesquisar", Icon: Search, destaque: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, destaque: false },
];

const MDB_KEY = "eldl-mdb-path";

export default function Inicio() {
  const [dash, setDash] = useState<DashboardDia | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoDash>("hoje");
  const [caminho, setCaminho] = useState(
    () => localStorage.getItem(MDB_KEY) ?? "../Livraria/livraria.mdb",
  );
  const [ocupado, setOcupado] = useState(false);
  const [rel, setRel] = useState<RelatorioMigracao | null>(null);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  function carregar() {
    dashboardDoDia(periodo).then(setDash).catch(() => setDash(null));
  }

  const periodoRotulo =
    PERIODOS.find((p) => p.id === periodo)?.rotulo.toLowerCase() ?? "hoje";

  function lembrarCaminho(p: string) {
    setCaminho(p);
    localStorage.setItem(MDB_KEY, p);
  }

  async function procurar() {
    try {
      const sel = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Banco Access", extensions: ["mdb", "accdb"] }],
      });
      if (typeof sel === "string") {
        lembrarCaminho(sel);
      }
    } catch {
      toast.error("Seletor de arquivo disponível só no app (não no navegador)");
    }
  }

  async function sincronizar() {
    setOcupado(true);
    try {
      const r = await migrarLegado(caminho.trim() || undefined);
      setRel(r);
      lembrarCaminho(caminho.trim());
      toast.success(`${r.livrosImportados} livros, ${r.pedidosInseridos} pedidos novos`);
      carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro na migração");
    } finally {
      setOcupado(false);
    }
  }

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

      <div className="mt-3 grid grid-cols-4 gap-3">
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

      <div className="mt-5 grid grid-cols-2 gap-4">
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

        <div className="bg-card rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Migração / Sincronização do legado</h2>
          <p className="text-muted-foreground mt-1 text-[12px]">
            Importa acervo e vendas do Access. Idempotente — pode repetir.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              value={caminho}
              onChange={(e) => lembrarCaminho(e.currentTarget.value)}
              className="h-9 font-mono text-[12px]"
              placeholder="Caminho do .mdb"
            />
            <Button
              variant="outline"
              onClick={procurar}
              className="h-9 shrink-0"
              title="Procurar arquivo .mdb"
            >
              <FolderOpen size={15} />
            </Button>
            <Button onClick={sincronizar} disabled={ocupado} className="h-9 shrink-0">
              <RefreshCw size={15} className={ocupado ? "animate-spin" : ""} />
            </Button>
          </div>
          {rel && (
            <div className="text-muted-foreground mt-3 text-[12px]">
              {rel.livrosImportados} livros · {rel.pedidosInseridos} pedidos novos ·{" "}
              {rel.pedidosExistentes} já existentes · {rel.divergencias.length} divergências
            </div>
          )}
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
