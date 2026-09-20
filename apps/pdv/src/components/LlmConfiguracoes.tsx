import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@livraria/ui/ui/button";
import { Card, CardHeader, CardContent } from "@livraria/ui/wowdash/card";

type Llm = { uid: string; nome: string; modelo: string; provedor: string };
function message(error: unknown): string {
  return error && typeof error === "object" && "mensagem" in error
    ? String(error.mensagem) : "Não foi possível conectar à retaguarda.";
}

export function LlmConfiguracoes() {
  const [rows, setRows] = useState<Llm[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  async function load() {
    setBusy(true); setFeedback(""); setFailed(false);
    try { setRows(await invoke<Llm[]>("llms_listar")); }
    catch (e) { setRows(null); setFeedback(message(e)); setFailed(true); }
    finally { setBusy(false); }
  }
  async function test(uid: string) {
    setBusy(true); setFeedback(""); setFailed(false);
    try {
      const result = await invoke<{ ok: boolean; mensagem: string }>("llm_testar", { uid });
      setFeedback(result.mensagem); setFailed(!result.ok);
    } catch (e) { setFeedback(message(e)); setFailed(true); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader className="space-y-2 border-b">
      <h2 className="text-sm font-semibold">Modelos de IA</h2>
      <p className="text-sm text-muted-foreground">Consulte as LLMs liberadas para este PDV. O teste usa a identificação da máquina e do responsável pelo turno aberto.</p>
    </CardHeader>
    <CardContent className="space-y-4 pt-4">
      <Button type="button" variant="outline" disabled={busy} onClick={() => void load()}>{busy ? "Aguarde…" : "Consultar modelos"}</Button>
      {rows?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma LLM liberada para o PDV. Cadastre na retaguarda.</p>}
      {rows?.map(row => <div key={row.uid} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{row.nome}</p><p className="break-all text-xs text-muted-foreground">{row.modelo}</p></div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void test(row.uid)}>Testar conexão</Button>
      </div>)}
      {feedback && <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}>{feedback}</p>}
      <p className="text-xs text-muted-foreground">Requer conexão com a retaguarda. O teste não gera conteúdo.</p>
    </CardContent>
  </Card>;
}
