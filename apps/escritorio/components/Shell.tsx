"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

// Telas sem a casca (pré-sessão): login e troca de senha.
const SEM_CASCA = ["/login", "/trocar-senha"];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (SEM_CASCA.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
