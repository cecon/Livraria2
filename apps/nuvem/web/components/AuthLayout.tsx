import { BookOpen, LibraryBig } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-card lg:grid-cols-[minmax(22rem,0.9fr)_1.1fr]">
      <section className="relative hidden min-h-dvh overflow-hidden bg-[#182230] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div aria-hidden="true" className="mx-auto grid w-full max-w-md grid-cols-5 items-end gap-3 px-6">
          {[62, 82, 54, 94, 70].map((altura, index) => (
            <div
              key={altura}
              className={`rounded-t-md border border-white/10 ${index === 3 ? "bg-[#45b369]" : "bg-white/8"}`}
              style={{ height: `${altura * 2}px` }}
            >
              <div className="mx-2 mt-4 h-px bg-white/20" />
              <div className="mx-2 mt-2 h-px bg-white/20" />
            </div>
          ))}
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#8dd5ae]">
            <LibraryBig className="size-4" />
            Gestão da livraria
          </div>
          <p className="max-w-md text-2xl font-semibold leading-snug">
            Informação organizada para decisões mais simples.
          </p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Brand dark /></div>
          <div className="admin-panel border bg-card p-5 sm:p-8">
            <div className="mb-6">
              <div className="section-kicker mb-2">Escritório</div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${dark ? "text-foreground" : "text-white"}`}>
      <span className="grid size-10 place-items-center rounded-md bg-[#45b369] text-white">
        <BookOpen className="size-5" />
      </span>
      <span>
        <span className="block text-base font-semibold leading-tight">Espaço do Livro</span>
        <span className={`block text-xs ${dark ? "text-muted-foreground" : "text-slate-400"}`}>Livraria</span>
      </span>
    </div>
  );
}
