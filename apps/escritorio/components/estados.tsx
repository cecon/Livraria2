// Estados compartilhados (carregando/vazio) — mesma linguagem visual do PDV (US1/T022).
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{texto}</div>;
}

export function Vazio({ texto = "Nada por aqui." }: { texto?: string }) {
  return (
    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
