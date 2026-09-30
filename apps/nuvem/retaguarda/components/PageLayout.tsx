import type { ReactNode } from "react";
import { cn } from "@/interface/utils";
export function PageLayout({
  children,
  className,
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 p-4 sm:p-6",
        size === "sm" ? "max-w-3xl" : "max-w-[1600px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
