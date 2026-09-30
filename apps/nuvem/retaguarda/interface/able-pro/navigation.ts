import {
  House,
  ShoppingCart,
  Clock,
  BookOpen,
  Search,
  PackagePlus,
  Truck,
  Wallet,
  HeartHandshake,
  ClipboardList,
  ChartNoAxesCombined,
  Monitor,
  Users,
  Bot,
} from "lucide-react";
export const navigation = [
  {
    label: "Painel",
    items: [
      { href: "/", label: "Visão geral", icon: House },
      { href: "/venda", label: "Vendas", icon: ShoppingCart },
      { href: "/turnos", label: "Turnos", icon: Clock },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/cadastro", label: "Livros", icon: BookOpen },
      { href: "/pesquisa", label: "Pesquisa", icon: Search },
      { href: "/lancamentos", label: "Lançamentos", icon: PackagePlus },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/inventario", label: "Inventário", icon: ClipboardList },
      { href: "/formas-pagamento", label: "Formas de pagamento", icon: Wallet },
      { href: "/destinacoes", label: "Destinações", icon: HeartHandshake },
      { href: "/relatorios", label: "Relatórios", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/pdvs", label: "Máquinas PDV", icon: Monitor },
      { href: "/usuarios", label: "Usuários", icon: Users },
      { href: "/llms", label: "Inteligência artificial", icon: Bot },
    ],
  },
];
