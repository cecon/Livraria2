import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { ConexaoBanner } from "@/components/ConexaoBanner";
import { Toaster } from "@livraria/ui/ui/sonner";

export const metadata: Metadata = {
  title: "Escritório — Livraria",
  description: "Retaguarda: recebimento, cadastros e consultas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: o next-themes ajusta a classe do <html> antes da hidratação.
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          <ConexaoBanner />
          <Shell>{children}</Shell>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
