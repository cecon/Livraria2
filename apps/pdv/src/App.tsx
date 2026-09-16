import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ErroMigracao } from "@/components/ErroMigracao";
import { Toaster } from "@/components/ui/sonner";
import { estadoBoot, type EstadoBoot } from "@/lib/ipc";
import { estadoMaquina, type MachineState } from "@/lib/ipc_machine";
import { aplicarTema, temaInicial, type Tema } from "@/lib/theme";
import { verificarAtualizacao } from "@/lib/updater";
import Inicio from "@/routes/Inicio";
import Venda from "@/routes/Venda";
import Turnos from "@/routes/Turnos";
import Pesquisa from "@/routes/Pesquisa";
import Relatorios from "@/routes/Relatorios";
import ConfigurarMaquina from "@/routes/ConfigurarMaquina";

function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);
  const [boot, setBoot] = useState<EstadoBoot | null>(null);
  const [machine, setMachine] = useState<MachineState | null>(null);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const versaoAvisada = useRef<string | null>(null);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  // FR-016a: se a migração de dados falhou no boot, bloqueia toda a operação.
  useEffect(() => {
    estadoBoot()
      .then(setBoot)
      .catch(() => setBoot({ ok: true })); // comando indisponível: segue normal
    estadoMaquina()
      .then(setMachine)
      .catch(() => setMachine({ configured: true, nome: null, nomeSugerido: "" }));
  }, []);

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

  if (boot && !boot.ok) {
    return <ErroMigracao detalhe={boot.erroMigracao} />;
  }

  if (!boot || !machine) {
    return <div className="bg-background min-h-screen" aria-label="Carregando" />;
  }

  if (!machine.configured) {
    return (
      <ConfigurarMaquina
        nomeSugerido={machine.nomeSugerido}
        tema={tema}
        onToggleTema={() => setTema((value) => (value === "dark" ? "light" : "dark"))}
        onConfigured={() =>
          setMachine((value) => (value ? { ...value, configured: true } : value))
        }
      />
    );
  }

  return (
    <BrowserRouter>
      <div className="bg-neutral-100 text-foreground flex h-screen overflow-hidden dark:bg-[#1e2734]">
        <AppSidebar
          tema={tema}
          abertoNoMobile={menuMobileAberto}
          recolhido={menuRecolhido}
          onCloseMobile={() => setMenuMobileAberto(false)}
          onToggleTema={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            tema={tema}
            onToggleTema={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
            onToggleMenu={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) {
                setMenuRecolhido((value) => !value);
              } else {
                setMenuMobileAberto(true);
              }
            }}
          />
          <main className="min-h-0 flex-1 overflow-auto">
            <Routes>
              {/* PDV consumidor: as rotas administrativas vivem na nuvem. */}
              <Route path="/" element={<Inicio />} />
              <Route path="/venda" element={<Venda />} />
              <Route path="/turnos" element={<Turnos />} />
              <Route path="/pesquisa" element={<Pesquisa />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
