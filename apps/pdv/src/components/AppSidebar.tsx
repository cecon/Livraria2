import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { BookOpen, Moon, Sun, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { NAV_ITENS_PDV as ITENS } from "@livraria/ui/nav";
import { OperadorAtual } from "./OperadorAtual";
import { SyncStatus } from "./SyncStatus";
import type { Tema } from "@/lib/theme";

interface Props {
  tema: Tema;
  abertoNoMobile: boolean;
  recolhido: boolean;
  onCloseMobile: () => void;
  onToggleTema: () => void;
}

export function AppSidebar({
  tema,
  abertoNoMobile,
  recolhido,
  onCloseMobile,
  onToggleTema,
}: Props) {
  const [versao, setVersao] = useState("");

  useEffect(() => {
    getVersion().then(setVersao).catch(() => setVersao(""));
  }, []);

  return (
    <>
      {abertoNoMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-neutral-200 bg-white text-neutral-700 transition-[width,transform] duration-200 dark:border-slate-700 dark:bg-[#273142] dark:text-slate-100 lg:static lg:translate-x-0 ${
          abertoNoMobile ? "translate-x-0" : "-translate-x-full"
        } ${recolhido ? "lg:w-[76px]" : "w-[260px]"}`}
      >
        <div className="flex h-[72px] shrink-0 items-center border-b border-neutral-200 px-4 dark:border-slate-700">
          <NavLink to="/" onClick={onCloseMobile} className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand text-white">
              <BookOpen size={22} />
            </span>
            {!recolhido && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-base font-semibold text-neutral-900 dark:text-white">
                  Espaco do Livro
                </span>
                <span className="block text-xs text-neutral-500 dark:text-slate-400">
                  PDV{versao && ` v${versao}`}
                </span>
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto grid size-9 place-items-center rounded-md hover:bg-neutral-100 lg:hidden dark:hover:bg-slate-700"
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {!recolhido && (
            <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase text-neutral-400">
              Operacao
            </p>
          )}
          {ITENS.map(({ to, rotulo, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onCloseMobile}
              title={recolhido ? rotulo : undefined}
              className={({ isActive }) =>
                `flex h-11 items-center rounded-md text-sm transition-colors ${
                  recolhido ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  isActive
                    ? "bg-brand text-white"
                    : "hover:bg-brand-50 hover:text-brand dark:hover:bg-slate-700 dark:hover:text-white"
                }`
              }
            >
              <Icon size={19} />
              {!recolhido && <span>{rotulo}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-neutral-200 p-3 dark:border-slate-700">
          {!recolhido && (
            <div className="space-y-3">
              <OperadorAtual />
              <SyncStatus />
            </div>
          )}
          <button
            type="button"
            onClick={onToggleTema}
            className={`mt-2 flex h-10 w-full items-center rounded-md text-sm hover:bg-brand-50 hover:text-brand dark:hover:bg-slate-700 dark:hover:text-white ${
              recolhido ? "justify-center" : "gap-3 px-3"
            }`}
            title={tema === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {!recolhido && (tema === "dark" ? "Tema claro" : "Tema escuro")}
          </button>
        </div>
      </aside>
    </>
  );
}
