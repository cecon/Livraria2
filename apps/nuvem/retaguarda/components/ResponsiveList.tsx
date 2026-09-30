import type { ReactNode } from "react";
import { cn } from "@/interface/utils";
export function ResponsiveList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("admin-panel divide-y overflow-hidden border bg-card", className)}>{children}</div>;
}
