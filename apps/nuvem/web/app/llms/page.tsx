"use client";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { ContentPanel } from "@/components/ContentPanel";
import { PageHeader } from "@/components/PageHeader";
import { LlmForm } from "./LlmForm";
import { request, type Llm } from "./types";

export default function Llms() {
  const [rows, setRows] = useState<Llm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Llm | null | undefined>(undefined);
  const [testing, setTesting] = useState<string | null>(null);
  const [result, setResult] = useState<{ uid: string; ok: boolean; mensagem: string } | null>(null);
  async function load() {
    setLoading(true); setError("");
    try { setRows(await request()); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function test(row: Llm) {
    setTesting(row.uid); setResult(null);
    try { setResult({ ...await request(`/${row.uid}/testar`, {}), uid: row.uid }); }
    catch (e) { setResult({ uid: row.uid, ok: false, mensagem: e instanceof Error ? e.message : "Teste indisponível." }); }
    finally { setTesting(null); }
  }
  const filtered = rows.filter(row => `${row.nome} ${row.modelo} ${row.provedor}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <div className="space-y-6">
    <PageHeader title="LLMs" description="Configure os modelos disponíveis para o PDV e a retaguarda." crumbs={[{ label: "LLMs" }]} />
    <ContentPanel title="Modelos cadastrados" flush toolbar={<div className="flex flex-wrap gap-3">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar LLM" className="pl-9" placeholder="Nome, modelo ou provedor" value={filter} onChange={e => setFilter(e.target.value)} /></div>
      <Button onClick={() => setEdit(null)}><Plus size={16} />Nova LLM</Button></div>}>
      {error ? <div role="alert" className="space-y-3 p-5"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>
        : loading ? <p role="status" className="p-5">Carregando configurações…</p>
        : !filtered.length ? <p className="p-5 text-sm text-muted-foreground">{rows.length ? "Nenhuma LLM encontrada." : "Nenhuma LLM cadastrada. Adicione um modelo para começar."}</p>
        : <div className="divide-y">{filtered.map(row => <div key={row.uid} className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-1"><h2 className="break-words text-sm font-semibold">{row.nome}</h2><p className="break-all text-xs text-muted-foreground">{row.provedor === "google" ? "Google Gemini" : "OpenAI / compatível"} · {row.modelo}</p>
              <p className="text-xs text-muted-foreground">{row.ativo ? "Ativa" : "Inativa"} · {[row.pdv && "PDV", row.retaguarda && "Retaguarda"].filter(Boolean).join(" e ")} · {row.possuiCredencial ? "Chave protegida" : "Sem chave"}</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!row.ativo || !!testing} onClick={() => void test(row)}>{testing === row.uid ? "Testando…" : "Testar conexão"}</Button><Button variant="outline" disabled={!!testing} onClick={() => setEdit(row)}>Editar</Button></div>
          </div>
          {result?.uid === row.uid && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>{result.mensagem}</p>}
        </div>)}</div>}
    </ContentPanel>
    <p className="text-xs text-muted-foreground">O teste consulta a disponibilidade do modelo. Não gera conteúdo nem envia dados de vendas.</p>
    {edit !== undefined && <LlmForm initial={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); setResult(null); void load(); }} />}
  </div>;
}
