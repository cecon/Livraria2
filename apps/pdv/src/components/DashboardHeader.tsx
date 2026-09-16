import { Menu, Moon, Search, Sun } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { Tema } from "@/lib/theme";

interface Props {
  tema: Tema;
  onToggleMenu: () => void;
  onToggleTema: () => void;
}

const TITULOS: Record<string, string> = {
  "/": "Inicio",
  "/venda": "Venda",
  "/turnos": "Turno",
  "/pesquisa": "Pesquisa",
  "/relatorios": "Relatorios",
};

export function DashboardHeader({ tema, onToggleMenu, onToggleTema }: Props) {
  const { pathname } = useLocation();

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 dark:border-slate-700 dark:bg-[#273142] sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onToggleMenu}
          className="grid size-10 shrink-0 place-items-center rounded-md text-neutral-600 hover:bg-brand-50 hover:text-brand dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Abrir ou recolher menu"
          title="Menu"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold sm:text-lg">
            {TITULOS[pathname] ?? "Ponto de venda"}
          </p>
          <p className="hidden text-xs text-neutral-500 sm:block dark:text-slate-400">
            Espaco do Livro
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/pesquisa"
          className="flex h-10 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm text-neutral-600 hover:border-brand-300 hover:text-brand dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-400"
          title="Pesquisar livros"
        >
          <Search size={18} />
          <span className="hidden md:inline">Pesquisar livros</span>
        </Link>
        <button
          type="button"
          onClick={onToggleTema}
          className="grid size-10 place-items-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-brand-50 hover:text-brand dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          title={tema === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
