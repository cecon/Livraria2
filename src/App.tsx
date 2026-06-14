import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { aplicarTema, temaInicial, type Tema } from "@/lib/theme";
import { verificarAtualizacao } from "@/lib/updater";
import Inicio from "@/routes/Inicio";
import Venda from "@/routes/Venda";
import Cadastro from "@/routes/Cadastro";
import Pesquisa from "@/routes/Pesquisa";
import Relatorios from "@/routes/Relatorios";

function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  useEffect(() => {
    verificarAtualizacao((versao, instalar) => {
      toast(`Atualização ${versao} disponível`, {
        description: "Baixar e reiniciar para aplicar?",
        duration: Infinity,
        action: {
          label: "Atualizar",
          onClick: () => {
            toast.loading("Baixando atualização…");
            void instalar();
          },
        },
      });
    });
  }, []);

  return (
    <BrowserRouter>
      <div className="bg-background text-foreground flex h-screen overflow-hidden">
        <AppSidebar
          tema={tema}
          onToggleTema={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
        />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/venda" element={<Venda />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/pesquisa" element={<Pesquisa />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
