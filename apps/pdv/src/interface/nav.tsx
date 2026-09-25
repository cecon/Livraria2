import {
  BookPlus,
  FileBarChart,
  Home,
  Search,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  to: string;
  rotulo: string;
  Icon: LucideIcon;
  end: boolean;
}

export const NAV_ITENS_PDV: ItemNav[] = [
  { to: "/", rotulo: "Início", Icon: Home, end: true },
  { to: "/venda", rotulo: "Venda", Icon: ShoppingCart, end: false },
  { to: "/pesquisa", rotulo: "Pesquisa", Icon: Search, end: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, end: false },
  { to: "/produtos", rotulo: "Produtos", Icon: BookPlus, end: false },
];
