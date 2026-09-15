"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import type { ReactNode } from "react";

type Crumb = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type BackAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function PageHeader({ title, description, crumbs, action, back }: {
  title: string;
  description?: string;
  crumbs: Crumb[];
  action?: ReactNode;
  back?: BackAction;
}) {
  return (
    <header className="space-y-3">
      <nav aria-label="Navegação estrutural" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" aria-label="Início" className="rounded p-1 transition-colors hover:bg-muted hover:text-primary">
          <Home className="size-3.5" />
        </Link>
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3 shrink-0" />
            <CrumbLink crumb={crumb} current={index === crumbs.length - 1} />
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {back ? <BackButton back={back} /> : null}
          <div className="min-w-0">
            <h1>{title}</h1>
            {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

function CrumbLink({ crumb, current }: { crumb: Crumb; current: boolean }) {
  const className = current
    ? "max-w-48 truncate font-medium text-foreground"
    : "max-w-48 truncate rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-primary";
  if (current) return <span aria-current="page" className={className}>{crumb.label}</span>;
  if (crumb.href) return <Link href={crumb.href} className={className}>{crumb.label}</Link>;
  if (crumb.onClick) return <button type="button" onClick={crumb.onClick} className={className}>{crumb.label}</button>;
  return <span className="max-w-48 truncate">{crumb.label}</span>;
}

function BackButton({ back }: { back: BackAction }) {
  const content = <ArrowLeft className="size-4" />;
  const className = "mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  if (back.href) {
    return <Link href={back.href} aria-label={back.label} title={back.label} className={className}>{content}</Link>;
  }
  return <button type="button" onClick={back.onClick} aria-label={back.label} title={back.label} className={className}>{content}</button>;
}
