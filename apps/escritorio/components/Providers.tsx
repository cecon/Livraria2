"use client";

import { ThemeProvider } from "next-themes";

// Tema por classe `.dark` no <html>, persistido na MESMA chave do PDV ("eldl-theme").
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="eldl-theme">
      {children}
    </ThemeProvider>
  );
}
