import type { ReactNode } from "react";
import { cn } from "@livraria/ui/utils";
export function ResponsiveActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 sm:justify-end", className)}>{children}</div>;
}
