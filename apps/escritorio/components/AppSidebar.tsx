"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Users } from "lucide-react";
import { NAV_ITENS } from "@livraria/ui/nav";

// Barra lateral do Escritório — MESMA aparência/itens do PDV (fonte única: @livraria/ui/nav),
// com navegação do Next (next/link + usePathname) e tema via next-themes.
export function AppSidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex items-center gap-2 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[#1f7a4d] text-sm font-bold text-white">
          EL
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Espaço do Livro</div>
          <div className="text-[11px] text-zinc-400">Escritório</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITENS.map(({ to, rotulo, Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              href={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800/60"
              }`}
            >
              <Icon size={18} />
              {rotulo}
            </Link>
          );
        })}
      </nav>

      {/* Só do Escritório (não entra no nav compartilhado do PDV) — gestão de usuários (feature 010). */}
      <Link
        href="/usuarios"
        className={`mx-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          pathname.startsWith("/usuarios")
            ? "bg-zinc-800 text-white"
            : "text-zinc-300 hover:bg-zinc-800/60"
        }`}
      >
        <Users size={18} />
        Usuários
      </Link>

      <button
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        {dark ? "Tema claro" : "Tema escuro"}
      </button>
    </aside>
  );
}
