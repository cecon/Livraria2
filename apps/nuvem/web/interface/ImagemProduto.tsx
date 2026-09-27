"use client";
import { useId, useState } from "react";
import { Cover } from "@/components/Cover";
import { enviarImagem } from "@/lib/imagens";
export function ImagemProduto({ value, titulo, disabled, onChange, onBusy }: {
  value: string | null; titulo: string; disabled?: boolean;
  onChange: (uid: string | null) => void; onBusy: (busy: boolean) => void;
}) {
  const id = useId(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusy(true); onBusy(true);
    try { onChange(await enviarImagem(file)); }
    catch(e) { setError(e instanceof Error ? e.message : (e as {mensagem?: string})?.mensagem ?? "Não foi possível enviar a imagem."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <fieldset disabled={disabled || busy} className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Imagem do produto</legend>
    <div className="flex flex-wrap items-start gap-4">
      <Cover titulo={titulo || "Produto"} capaUid={value} tamanho="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <label htmlFor={id} className="block text-sm font-medium">{value ? "Trocar imagem" : "Adicionar imagem"}</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full min-w-0 text-sm file:mr-2 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-foreground"
          onChange={e => { void choose(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
        <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MB. A foto será vinculada ao salvar o produto.</p>
        {value && <button type="button" onClick={() => onChange(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Remover imagem</button>}
      </div>
    </div>
    {busy && <p role="status" className="text-sm text-muted-foreground">Enviando imagem…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
