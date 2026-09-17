"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Home, LogOut, Menu, UserRound } from "lucide-react";
import { AppSidebar } from "./AppSidebar";

const SEM_CASCA = ["/login", "/trocar-senha"];

type ShellProps = {
  children: React.ReactNode;
  usuario: string | null;
};

export function Shell({ children, usuario }: ShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  if (SEM_CASCA.some((p) => pathname.startsWith(p))) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-col md:ml-64">
        <Header usuario={usuario} onMenu={() => setNavOpen(true)} />
        <div className="admin-content min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Header({ usuario, onMenu }: { usuario: string | null; onMenu: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const nome = usuario || "Sessao ativa";
  const pagina = TITULOS[pathname] ?? "Escritório";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 shadow-[0_1px_2px_rgb(16_24_40/0.03)] sm:h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={onMenu} className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card text-card-foreground md:hidden" aria-label="Abrir menu"><Menu className="size-5" /></button>
        <nav aria-label="Localização" className="flex min-w-0 items-center gap-2 text-sm">
          <Link href="/" aria-label="Início" className="hidden text-muted-foreground transition-colors hover:text-primary sm:block"><Home className="size-4" /></Link>
          <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
          <span className="truncate font-semibold">{pagina}</span>
        </nav>
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 max-w-[48vw] items-center gap-2 rounded-md border border-transparent px-2.5 text-sm text-card-foreground transition-colors hover:border-border hover:bg-muted sm:max-w-56"
        >
          <UserRound className="size-4 text-muted-foreground" />
          <span className="truncate">{nome}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
              {nome}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="mt-1 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

const TITULOS: Record<string, string> = {
  "/": "Visão geral",
  "/venda": "Vendas",
  "/turnos": "Turnos",
  "/cadastro": "Cadastro",
  "/pesquisa": "Pesquisa",
  "/lancamentos": "Lançamentos",
  "/fornecedores": "Fornecedores",
  "/formas-pagamento": "Formas de pagamento",
  "/destinacoes": "Destinações",
  "/inventario": "Inventário",
  "/relatorios": "Relatórios",
  "/pdvs": "Máquinas sincronizadas",
  "/usuarios": "Usuários",
};
