import type { ReactNode } from "react";
import { cn } from "@livraria/ui/utils";
export function ResponsiveList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y overflow-hidden rounded-lg border bg-card", className)}>{children}</div>;
}
