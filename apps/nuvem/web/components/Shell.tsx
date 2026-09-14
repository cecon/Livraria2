"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { AppSidebar } from "./AppSidebar";

const SEM_CASCA = ["/login", "/trocar-senha"];

type ShellProps = {
  children: React.ReactNode;
  usuario: string | null;
};

export function Shell({ children, usuario }: ShellProps) {
  const pathname = usePathname();
  if (SEM_CASCA.some((p) => pathname.startsWith(p))) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-stretch bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header usuario={usuario} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Header({ usuario }: { usuario: string | null }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const nome = usuario || "Sessao ativa";

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
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">Escritorio</div>
        <div className="truncate text-xs text-muted-foreground">Retaguarda</div>
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-card-foreground transition-colors hover:bg-muted"
        >
          <UserRound className="size-4 text-muted-foreground" />
          <span className="max-w-40 truncate">{nome}</span>
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
