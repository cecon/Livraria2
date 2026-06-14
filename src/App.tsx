import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { aplicarTema, temaInicial, type Tema } from "@/lib/theme";
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
