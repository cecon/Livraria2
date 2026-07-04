// Tela de bloqueio quando a migração de dados falha no boot (FR-016a).
// O rollback preservou os dados; o app abre APENAS para exibir este aviso —
// sem navegação, PDV ou cadastros — até o problema ser resolvido.

import { AlertTriangle } from "lucide-react";

export function ErroMigracao({ detalhe }: { detalhe?: string }) {
  return (
    <div className="bg-background text-foreground grid h-screen place-items-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={48} />
        <h1 className="text-xl font-semibold">
          A atualização dos dados não foi concluída
        </h1>
        <p className="text-muted-foreground text-sm">
          Nenhuma venda ou valor foi perdido: o sistema desfez a alteração e os
          dados originais estão intactos. Para proteger o histórico, o programa
          não pode ser usado até o problema ser resolvido.
        </p>
        <p className="text-sm font-medium">
          Não registre vendas — procure o suporte e informe a mensagem abaixo.
        </p>
        {detalhe && (
          <pre className="bg-muted text-muted-foreground overflow-auto rounded-md p-3 text-left font-mono text-[11px] whitespace-pre-wrap">
            {detalhe}
          </pre>
        )}
      </div>
    </div>
  );
}
