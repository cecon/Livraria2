"use client";
import { useState } from "react";
const TAM = { sm: "h-10 w-8 text-[10px]", md: "h-16 w-12 text-sm", lg: "h-40 w-28 text-xl" };
export function Cover({ titulo, capaUid, tamanho = "md" }: { titulo: string; capaUid?: string | null; tamanho?: keyof typeof TAM }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = capaUid ? `/api/capas/${capaUid}` : null;
  return <div className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-muted ${TAM[tamanho]}`}>
    {src && failed !== src ? <img src={src} alt={`Capa de ${titulo}`} loading="lazy" decoding="async"
      className="h-full w-full object-contain" onError={() => setFailed(src)} /> :
      <span aria-label={`Sem imagem: ${titulo}`} className="text-muted-foreground font-semibold">{titulo.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join("").toUpperCase()}</span>}
  </div>;
}
