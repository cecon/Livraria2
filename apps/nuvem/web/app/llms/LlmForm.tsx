"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@livraria/ui/ui/dialog";
import { addresses, request, type Llm } from "./types";

export function LlmForm({ initial, onClose, onSaved }: { initial: Llm | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<Llm, "uid" | "versao" | "possuiCredencial"> & { versao?: number }>(initial ?? { nome: "", provedor: "openai-compatible",
    endereco: addresses["openai-compatible"], modelo: "", ativo: true, pdv: true, retaguarda: true });
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request(initial ? `/${initial.uid}` : "", { ...form, credencial: secret || undefined }, initial ? "PUT" : "POST");
      setSecret(""); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-xl">
      <DialogTitle className="text-lg font-semibold">{initial ? "Editar LLM" : "Nova LLM"}</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">Configure o modelo e onde ele poderá ser usado.</DialogDescription>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="llm-name">Nome</Label><Input id="llm-name" required maxLength={100} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="llm-provider">Provedor</Label>
          <select id="llm-provider" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.provedor} onChange={e => {
            const provedor = e.target.value as Llm["provedor"]; setForm({ ...form, provedor, endereco: addresses[provedor] }); setSecret("");
          }}><option value="openai-compatible">OpenAI e APIs compatíveis</option><option value="google">Google Gemini</option></select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="llm-url">Endereço da API</Label><Input id="llm-url" type="url" required maxLength={500} value={form.endereco} readOnly={form.provedor === "google"} onChange={e => setForm({ ...form, endereco: e.target.value })} />
          <p className="text-xs text-muted-foreground">Para outros provedores ou servidores locais, use o endereço liberado pela administração.</p></div>
        <div className="space-y-1.5"><Label htmlFor="llm-model">Modelo</Label><Input id="llm-model" required maxLength={200} value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="llm-key">Chave de API</Label><Input id="llm-key" type="password" autoComplete="new-password" maxLength={4096} value={secret} onChange={e => setSecret(e.target.value)} />
          <p className="text-xs text-muted-foreground">{initial?.possuiCredencial ? "Chave já protegida. Deixe em branco para mantê-la." : "Opcional apenas em servidores compatíveis que dispensam autenticação."}</p></div>
        <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Disponibilidade</legend>
          {([['ativo','Ativa'],['pdv','PDV'],['retaguarda','Retaguarda']] as const).map(([key,label]) =>
            <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} />{label}</label>)}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
