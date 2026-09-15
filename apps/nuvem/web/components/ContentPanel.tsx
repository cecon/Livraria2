import { cn } from "@livraria/ui/utils";
import type { ReactNode } from "react";

export function ContentPanel({ title, description, toolbar, children, footer, flush = false, className }: {
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const hasHeader = title || description || toolbar;
  return (
    <section className={cn("admin-panel overflow-hidden border bg-card", className)}>
      {hasHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
          <div>
            {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {toolbar ? <div className="w-full sm:w-auto">{toolbar}</div> : null}
        </header>
      ) : null}
      <div className={flush ? undefined : "p-4 sm:p-5"}>{children}</div>
      {footer ? <footer className="border-t bg-muted/25 px-4 py-3 sm:px-5">{footer}</footer> : null}
    </section>
  );
}
