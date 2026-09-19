import { LockKeyhole, Play, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@livraria/ui/ui/button";

export default function CaixaFechado({ carregando = false, erro = false, onRetry }: {
  carregando?: boolean;
  erro?: boolean;
  onRetry?: () => void;
}) {
  return <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-8">
    <LockKeyhole className="mb-5 size-11 text-brand" aria-hidden="true" />
    <h1 className="text-2xl font-semibold">{erro ? "Não foi possível verificar o caixa" : "Caixa fechado"}</h1>
    {carregando ? <p className="mt-2 text-sm text-muted-foreground">Verificando turno atual…</p> :
      erro ? <p className="mt-2 text-sm text-muted-foreground">Tente novamente antes de iniciar a operação.</p> : null}
    <div className="mt-6">
      {erro ? <Button onClick={onRetry}><RefreshCw /> Tentar novamente</Button> :
        !carregando ? <Button asChild size="lg" className="bg-brand px-5 text-white hover:bg-brand-600"><Link to="/abrir-caixa"><Play /> Abrir caixa</Link></Button> : null}
    </div>
  </div>;
}
