// Placeholder de capa (iniciais + faixa verde) — igual ao PDV.
function iniciais(titulo: string): string {
  return titulo
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const TAM = {
  sm: "h-10 w-8 text-[10px]",
  md: "h-16 w-12 text-sm",
  lg: "h-28 w-20 text-xl",
};

export function Cover({ titulo, tamanho = "md" }: { titulo: string; tamanho?: keyof typeof TAM }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-md bg-[#1f7a4d] font-bold text-white ${TAM[tamanho]}`}>
      {iniciais(titulo)}
    </div>
  );
}
