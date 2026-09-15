import type { ReactNode } from "react";
import { cn } from "@livraria/ui/utils";

export function PageLayout({ children, className, size = "md" }: {
  children: ReactNode; className?: string; size?: "sm" | "md" | "lg";
}) {
  const width = size === "sm" ? "max-w-2xl" : size === "lg" ? "max-w-5xl" : "max-w-4xl";
  return <div className={cn("mx-auto w-full space-y-5 px-4 py-5 sm:p-6 lg:py-7", width, className)}>{children}</div>;
}
