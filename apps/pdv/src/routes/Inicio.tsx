// Tela Início (feature 012, US5): lista de vendas do turno aberto.
// O dashboard de estoque/analytics saiu — o estoque oficial vive na nuvem
// (ADR-0023/0024). O PDV mostra o operacional do turno (100% offline).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  ArrowDown,
  ArrowUp,
  Clock3,
  FileBarChart,
  LockKeyhole,
  ReceiptText,
  Search,
  ShoppingCart,
} from "lucide-react";
import { brl } from "@/lib/format";
import { Button } from "@livraria/ui/wowdash/button";
import { listarOperadores, type TurnoAberto } from "@/lib/ipc";
import { vendasDoTurno, type VendaTurno } from "@/lib/ipc-turno";

const ACOES = [
  { to: "/venda", rotulo: "Nova Venda", Icon: ShoppingCart, destaque: true },
  { to: "/pesquisa", rotulo: "Pesquisar", Icon: Search, destaque: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, destaque: false },
];

export default function Inicio({ turno }: { turno: TurnoAberto }) {
  const [vendas, setVendas] = useState<VendaTurno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [responsavel, setResponsavel] = useState(turno.operador);

  useEffect(() => {
    let ativo = true;
    setResponsavel(turno.operador);
    listarOperadores().then((operadores) => {
      const usuario = operadores.find((item) => item.usuario.toLowerCase() === turno.operador.toLowerCase());
      if (ativo) setResponsavel(usuario?.nome || turno.operador);
    }).catch(() => {});
    return () => { ativo = false; };
  }, [turno.operador]);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const dados = await vendasDoTurno(turno.syncUid);
        if (vivo) setVendas(dados);
      } catch {
        if (vivo) {
          setVendas([]);
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    }
    carregar();
    return () => {
      vivo = false;
    };
  }, [turno.syncUid]);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const ativas = vendas.filter((v) => !v.cancelada);
  const totalTurno = ativas.reduce((s, v) => s + v.totalCentavos, 0);
  const resumo = [
    {
      rotulo: "Turno atual",
      valor: "Aberto",
      detalhe: `Responsável: ${responsavel}`,
      Icon: Clock3,
      cor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    },
    {
      rotulo: "Vendas do turno",
      valor: String(ativas.length),
      detalhe: "",
      Icon: ReceiptText,
      cor: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    },
    {
      rotulo: "Total vendido",
      valor: brl(totalTurno),
      detalhe: "",
      Icon: Banknote,
      cor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Painel do PDV</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
            Acompanhe o turno e acesse as operacoes do caixa.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-sm:w-full">
          <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
            <Link to="/turnos?movimento=sangria"><ArrowUp size={16} /> Adicionar sangria</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
            <Link to="/turnos?movimento=suprimento"><ArrowDown size={16} /> Adicionar suprimento</Link>
          </Button>
          <Button asChild variant="destructive" className="h-10 w-full sm:w-auto">
            <Link to="/turnos?encerrar=1"><LockKeyhole size={16} /> Encerrar turno</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {resumo.map(({ rotulo, valor, detalhe, Icon, cor }) => (
          <div key={rotulo} className="wow-card flex items-center gap-4 p-5">
            <span className={`grid size-12 shrink-0 place-items-center rounded-full ${cor}`}>
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-neutral-500 dark:text-slate-400">{rotulo}</p>
              <p className="mt-1 truncate text-xl font-semibold">{valor}</p>
              {detalhe ? <p className="mt-1 truncate text-xs text-neutral-500 dark:text-slate-400" title={detalhe}>{detalhe}</p> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {ACOES.map(({ to, rotulo, Icon, destaque }) => (
          <Link
            key={to}
            to={to}
            className={`flex h-14 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium shadow-sm transition-colors ${
              destaque
                ? "bg-brand text-white hover:bg-brand-600"
                : "bg-white hover:bg-brand-50 hover:text-brand dark:bg-[#273142] dark:hover:bg-slate-700"
            }`}
          >
            <Icon size={18} />
            {rotulo}
          </Link>
        ))}
      </div>

      <section className="wow-card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Vendas do turno</h2>
            <p className="mt-0.5 text-xs capitalize text-neutral-500 dark:text-slate-400">
              {hoje}
            </p>
          </div>
          <span className="text-muted-foreground text-xs">{ativas.length} venda(s) · {brl(totalTurno)}</span>
        </div>

        <div className="min-h-28 px-5 py-5 sm:px-6">
          {carregando ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : vendas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma venda neste turno ainda.</p>
          ) : (
            <div className="divide-y">
              {vendas.map((v) => (
                <div key={v.numero} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-sm">Pedido {v.numero}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{v.data}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.cancelada && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        cancelada
                      </span>
                    )}
                    <span
                      className={`font-mono text-sm ${
                        v.cancelada ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {brl(v.totalCentavos)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
