// Itens de navegação — FONTE ÚNICA (ADR-0020). Consumidos pelo PDV (react-router)
// e pelo Escritório (next/link), garantindo a MESMA barra lateral (SC-001).
import {
  AlertTriangle,
  BookPlus,
  ClipboardList,
  Clock,
  FileBarChart,
  HeartHandshake,
  Home,
  PackagePlus,
  Search,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  to: string;
  rotulo: string;
  Icon: LucideIcon;
  end: boolean;
}

export const NAV_ITENS: ItemNav[] = [
  { to: "/", rotulo: "Início", Icon: Home, end: true },
  { to: "/venda", rotulo: "Venda", Icon: ShoppingCart, end: false },
  { to: "/turnos", rotulo: "Turno", Icon: Clock, end: false },
  { to: "/cadastro", rotulo: "Cadastro", Icon: BookPlus, end: false },
  { to: "/pesquisa", rotulo: "Pesquisa", Icon: Search, end: false },
  { to: "/lancamentos", rotulo: "Lançamentos", Icon: PackagePlus, end: false },
  { to: "/fornecedores", rotulo: "Fornecedores", Icon: Truck, end: false },
  { to: "/formas-pagamento", rotulo: "Formas de Pagamento", Icon: Wallet, end: false },
  { to: "/destinacoes", rotulo: "Destinações", Icon: HeartHandshake, end: false },
  { to: "/inventario", rotulo: "Inventário", Icon: ClipboardList, end: false },
  { to: "/estoque/divergencias", rotulo: "Divergências", Icon: AlertTriangle, end: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, end: false },
];

// PDV = consumidor (feature 012): sem cadastro/lançamento/inventário nem edição de
// cadastros (fornecedor/forma de pagamento/destinação) — tudo isso vive na nuvem.
// O Escritório continua usando NAV_ITENS (lista cheia), onde a edição mora.
export const NAV_ITENS_PDV: ItemNav[] = NAV_ITENS.filter(
  (item) =>
    ![
      "/cadastro",
      "/lancamentos",
      "/inventario",
      "/estoque/divergencias",
      "/fornecedores",
      "/formas-pagamento",
      "/destinacoes",
    ].includes(item.to),
);
