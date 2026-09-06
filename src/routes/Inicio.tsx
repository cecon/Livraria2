// Tela Início (feature 012, US5): lista de vendas do turno aberto.
// O dashboard de estoque/analytics saiu — o estoque oficial vive na nuvem
// (ADR-0023/0024). O PDV mostra o operacional do turno (100% offline).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, Search, ShoppingCart } from "lucide-react";
import { brl } from "@/lib/format";
import { operadorAtual } from "@/lib/operador";
import { turnoAberto, type TurnoAberto } from "@/lib/ipc";
import { vendasDoTurno, type VendaTurno } from "@/lib/ipc-turno";
import { CartaoVenda } from "@/components/CartaoVenda";

const ACOES = [
  { to: "/venda", rotulo: "Nova Venda", Icon: ShoppingCart, destaque: true },
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
      try {
        // Feature 013: o turno é da MÁQUINA — a lista não depende de quem logou.
        const t = await turnoAberto();
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
  const ativas = vendas.filter((v) => !v.cancelado);
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
          {carregando ? (
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
            <div className="space-y-2">
              {vendas.map((v) => (
                <CartaoVenda key={v.numero} p={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
