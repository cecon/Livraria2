import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escritório — Livraria",
  description: "Retaguarda: recebimento, cadastros e consultas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
