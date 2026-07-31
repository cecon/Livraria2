// Tela Início (feature 012, US5): lista de vendas do turno aberto.
// O dashboard de estoque/analytics saiu — o estoque oficial vive na nuvem
// (ADR-0023/0024). O PDV mostra o operacional do turno (100% offline).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookPlus, FileBarChart, Search, ShoppingCart } from "lucide-react";
import { brl } from "@/lib/format";
import { operadorAtual } from "@/lib/operador";
import { turnoAberto, type TurnoAberto } from "@/lib/ipc";
import { vendasDoTurno, type VendaTurno } from "@/lib/ipc-turno";

const ACOES = [
  { to: "/venda", rotulo: "Nova Venda", Icon: ShoppingCart, destaque: true },
  { to: "/cadastro", rotulo: "Cadastrar Livro", Icon: BookPlus, destaque: false },
  { to: "/pesquisa", rotulo: "Pesquisar", Icon: Search, destaque: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, destaque: false },
];

export default function Inicio() {
  const operador = operadorAtual();
  const [turno, setTurno] = useState<TurnoAberto | null>(null);
  const [vendas, setVendas] = useState<VendaTurno[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      setCarregando(true);
      if (!operador) {
        if (vivo) {
          setTurno(null);
          setVendas([]);
          setCarregando(false);
        }
        return;
      }
      try {
        const t = await turnoAberto(operador);
        if (!vivo) return;
        setTurno(t);
        setVendas(t ? await vendasDoTurno(t.syncUid) : []);
      } catch {
        if (vivo) {
          setTurno(null);
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
  }, [operador]);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const ativas = vendas.filter((v) => !v.cancelada);
  const totalTurno = ativas.reduce((s, v) => s + v.totalCentavos, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Espaço do Livro</h1>
          <p className="text-muted-foreground text-sm">Bem-vindo de volta.</p>
        </div>
        <div className="text-muted-foreground text-sm capitalize">{hoje}</div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
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

      <div className="bg-card mt-5 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Vendas do turno</h2>
          {turno && (
            <span className="text-muted-foreground text-xs">
              {ativas.length} venda(s) · {brl(totalTurno)}
            </span>
          )}
        </div>

        <div className="mt-3">
          {!operador ? (
            <p className="text-muted-foreground text-sm">
              Selecione o operador do caixa (barra lateral) para ver o turno.
            </p>
          ) : carregando ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : !turno ? (
            <p className="text-muted-foreground text-sm">
              Nenhum turno aberto.{" "}
              <Link to="/turnos" className="text-[#1f7a4d] underline">
                Abrir turno
              </Link>{" "}
              para começar.
            </p>
          ) : vendas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma venda neste turno ainda.</p>
          ) : (
            <div className="divide-y">
              {vendas.map((v) => (
                <div key={v.numero} className="flex items-center justify-between py-2">
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
      </div>
    </div>
  );
}
