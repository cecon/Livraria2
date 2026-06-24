// Barra lateral fixa (256px), sempre escura (design handoff). Navegação + tema.

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import {
  BookPlus,
  ClipboardList,
  FileBarChart,
  Home,
  Moon,
  PackagePlus,
  Search,
  ShoppingCart,
  Sun,
} from "lucide-react";
import type { Tema } from "@/lib/theme";

const ITENS = [
  { to: "/", rotulo: "Início", Icon: Home, end: true },
  { to: "/venda", rotulo: "Venda", Icon: ShoppingCart, end: false },
  { to: "/cadastro", rotulo: "Cadastro", Icon: BookPlus, end: false },
  { to: "/pesquisa", rotulo: "Pesquisa", Icon: Search, end: false },
  { to: "/entrada", rotulo: "Entrada", Icon: PackagePlus, end: false },
  { to: "/inventario", rotulo: "Inventário", Icon: ClipboardList, end: false },
  { to: "/relatorios", rotulo: "Relatórios", Icon: FileBarChart, end: false },
];

interface Props {
  tema: Tema;
  onToggleTema: () => void;
}

export function AppSidebar({ tema, onToggleTema }: Props) {
  const [versao, setVersao] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersao)
      .catch(() => setVersao(""));
  }, []);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[#1f7a4d] text-sm font-bold text-white">
          EL
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Espaço do Livro</div>
          <div className="text-[11px] text-zinc-400">
            Livraria 2{versao && ` · v${versao}`}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {ITENS.map(({ to, rotulo, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-300 hover:bg-zinc-800/60"
              }`
            }
          >
            <Icon size={18} />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={onToggleTema}
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60"
      >
        {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        {tema === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
    </aside>
  );
}
