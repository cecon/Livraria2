"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  BookOpen,
  MonitorCheck,
  Moon,
  Settings2,
  Sun,
  Users,
  Bot,
  X,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITENS, type ItemNav } from "@livraria/ui/nav";

type NavEntry = ItemNav | {
  to: string;
  rotulo: string;
  Icon: LucideIcon;
  end: boolean;
};

const extra: NavEntry[] = [
  { to: "/llms", rotulo: "LLMs", Icon: Bot, end: false },
  { to: "/pdvs", rotulo: "Máquinas", Icon: MonitorCheck, end: false },
  { to: "/usuarios", rotulo: "Usuários", Icon: Users, end: false },
];

const GRUPOS = [
  { titulo: "Operação", rotas: ["/", "/venda", "/turnos"] },
  { titulo: "Catálogo", rotas: ["/cadastro", "/pesquisa", "/lancamentos", "/fornecedores"] },
  { titulo: "Gestão", rotas: ["/formas-pagamento", "/destinacoes", "/inventario", "/relatorios"] },
  { titulo: "Administração", rotas: ["/pdvs", "/usuarios", "/llms"] },
];

export function AppSidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const entries = [
    ...NAV_ITENS.map((item) => item.to === "/venda" ? { ...item, rotulo: "Vendas" } :
      item.to === "/turnos" ? { ...item, rotulo: "Turnos" } : item),
    ...extra,
  ];

  return (
    <>
      {open ? (
        <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/55 md:hidden" onClick={onClose} />
      ) : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[86vw] flex-col border-r border-white/8 bg-[#182230] text-white transition-transform md:w-64 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[#45b369] text-white shadow-[0_6px_16px_rgb(69_179_105/0.22)]">
            <BookOpen className="size-5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">Espaço do Livro</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="status-dot" />
              Escritório
            </div>
          </div>
          <button type="button" aria-label="Fechar menu" onClick={onClose} className="grid size-9 place-items-center rounded-md text-slate-300 hover:bg-white/8 md:hidden">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-semibold text-slate-500 uppercase">{grupo.titulo}</div>
              <div className="space-y-1">
                {entries.filter((item) => grupo.rotas.includes(item.to)).map((item) => (
                  <NavLink key={item.to} item={item} pathname={pathname} onClose={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/8 p-3">
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            <span className="flex-1 text-left">{dark ? "Tema claro" : "Tema escuro"}</span>
            <Settings2 className="size-3.5 text-slate-500" />
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, pathname, onClose }: { item: NavEntry; pathname: string; onClose?: () => void }) {
  const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
  const { Icon } = item;
  return (
    <Link
      href={item.to}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${active ? "bg-[#45b369]/14 font-medium text-white" : "text-slate-300 hover:bg-white/7 hover:text-white"}`}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#45b369]" /> : null}
      <Icon className={`size-[18px] ${active ? "text-[#6fc79b]" : "text-slate-400"}`} />
      <span className="truncate">{item.rotulo}</span>
    </Link>
  );
}
