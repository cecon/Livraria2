import { useState, type FormEvent } from "react";
import { BookOpen, Eye, EyeOff, LoaderCircle, MonitorCog, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { configurarMaquina } from "@/lib/ipc_machine";
import { sincronizarAgora } from "@/lib/ipc_sync";
import type { Tema } from "@/lib/theme";

interface Props {
  nomeSugerido: string;
  tema: Tema;
  onToggleTema: () => void;
  onConfigured: () => void;
}

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Nao foi possivel configurar esta maquina";
}

export default function ConfigurarMaquina({
  nomeSugerido,
  tema,
  onToggleTema,
  onConfigured,
}: Props) {
  const [nome, setNome] = useState(nomeSugerido);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await configurarMaquina({ nome, usuario: usuario.trim().toLowerCase(), senha });
      try {
        await sincronizarAgora();
      } catch {
        // A maquina ja esta pronta; o agendador repetira a carga quando houver rede.
      }
      onConfigured();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,42%)_1fr]">
        <section className="bg-[#152232] text-white hidden min-h-screen flex-col justify-between p-10 lg:flex">
          <div className="flex items-center gap-3">
            <span className="bg-brand flex size-10 items-center justify-center rounded-lg">
              <BookOpen aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold">Espaco do Livro</p>
              <p className="text-sm text-slate-300">Ponto de venda</p>
            </div>
          </div>
          <div className="max-w-sm">
            <MonitorCog aria-hidden="true" className="mb-6 size-12 text-emerald-400" />
            <h1 className="text-3xl font-semibold">Configurar maquina</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Vincule este computador a uma maquina ativa da livraria.
            </p>
          </div>
          <p className="text-xs text-slate-400">Credencial protegida pelo Windows</p>
        </section>

        <section className="relative flex min-h-screen items-center px-5 py-10 sm:px-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-5 top-5"
            title={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            onClick={onToggleTema}
          >
            {tema === "dark" ? <Sun /> : <Moon />}
          </Button>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <span className="bg-brand mb-5 flex size-10 items-center justify-center rounded-lg text-white">
                <BookOpen aria-hidden="true" className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold">Configurar maquina</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Vincule este computador ao ponto de venda.
              </p>
            </div>

            <div className="hidden lg:block">
              <p className="text-brand text-sm font-semibold">Primeiro acesso</p>
              <h2 className="mt-2 text-2xl font-semibold">Identifique este PDV</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Entre com um administrador para concluir o vinculo.
              </p>
            </div>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="machine-name">Nome da maquina</Label>
                <Input
                  id="machine-name"
                  autoFocus
                  autoComplete="organization-title"
                  value={nome}
                  maxLength={100}
                  disabled={loading}
                  className="h-12"
                  onChange={(event) => setNome(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-user">Usuario administrador</Label>
                <Input
                  id="admin-user"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={usuario}
                  maxLength={100}
                  disabled={loading}
                  className="h-12"
                  onChange={(event) => setUsuario(event.target.value.toLowerCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={senha}
                    maxLength={200}
                    disabled={loading}
                    className="h-12 pr-12"
                    onChange={(event) => setSenha(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-destructive text-sm" role="alert" aria-live="polite">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="bg-brand hover:bg-brand-600 h-12 w-full text-white"
                disabled={loading || !nome.trim() || !usuario.trim() || !senha}
              >
                {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {loading ? "Configurando..." : "Configurar maquina"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
