import { useEffect, useRef, useState } from "react";
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
import Lancamentos from "@/routes/Lancamentos";
import Fornecedores from "@/routes/Fornecedores";
import Inventario from "@/routes/Inventario";
import Relatorios from "@/routes/Relatorios";

function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);
  const versaoAvisada = useRef<string | null>(null);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  useEffect(() => {
    function checar() {
      verificarAtualizacao((versao, instalar) => {
        // compulsório: aplica automaticamente. Dedupe para não reinstalar a mesma versão.
        if (versaoAvisada.current === versao) return;
        versaoAvisada.current = versao;
        toast.loading(`Atualizando para ${versao}… o app vai reiniciar`, {
          duration: Infinity,
        });
        void instalar();
      });
    }

    checar(); // no boot
    const id = window.setInterval(checar, 15 * 60 * 1000); // a cada 15 min
    window.addEventListener("focus", checar); // ao voltar o foco
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", checar);
    };
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
            <Route path="/lancamentos" element={<Lancamentos />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/inventario" element={<Inventario />} />
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
