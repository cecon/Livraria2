import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
const TAM = { sm: "h-10 w-8 text-[10px]", md: "h-16 w-12 text-sm", lg: "h-40 w-28 text-xl" };
export function Cover({ titulo, codigo, capaUid, tamanho = "md" }: {
  titulo: string; codigo?: string; capaUid?: string | null; tamanho?: keyof typeof TAM;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let loading = false;
    setSrc(null); setFailed(null);
    const load = async () => {
      if (loading || (!codigo && !capaUid)) return;
      loading = true;
      try { const image = await invoke<string | null>("imagem_produto", { codigo: codigo ?? null, uid: capaUid ?? null });
        if (active) setSrc(image);
      } catch { /* A venda continua mesmo sem imagem ou rede. */ }
      finally { loading = false; }
    };
    void load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener("focus", load);
    window.addEventListener("imagens-atualizadas", load);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", load); window.removeEventListener("imagens-atualizadas", load); };
  }, [codigo, capaUid]);
  return <div className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-muted ${TAM[tamanho]}`}>
    {src && failed !== src ? <img src={src} alt={`Capa de ${titulo}`} loading="lazy" decoding="async"
      className="h-full w-full object-contain" onError={() => setFailed(src)} /> :
      <span aria-label={`Sem imagem: ${titulo}`} className="text-muted-foreground font-semibold">{titulo.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join("").toUpperCase()}</span>}
  </div>;
}
