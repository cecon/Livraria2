"use client";

import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Badge } from "@livraria/ui/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarFormas, salvarForma, type Forma } from "@/lib/nuvem/forma";
import { Carregando, Vazio } from "@/components/estados";

type FormState = { sync_uid?: string; chave?: string; de_sistema?: boolean; rotulo: string; ordem: string; ativa: boolean };
const vazioForm = (): FormState => ({ rotulo: "", ordem: "0", ativa: true });

// Formas de pagamento (US2/T029) — dedup por chave; LWW. Formas de sistema
// preservam a chave ao editar (upsert por sync_uid).
export default function FormasPagamentoPage() {
  const [lista, setLista] = useState<Forma[] | null>(null);
  const [form, setForm] = useState<FormState>(vazioForm());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLista(await listarFormas());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.rotulo.trim()) {
      setErro("Informe o rótulo.");
      return;
    }
    setSalvando(true);
    const { error } = await salvarForma({
      sync_uid: form.sync_uid,
      chave: form.chave,
      de_sistema: form.de_sistema,
      rotulo: form.rotulo,
      ordem: Number(form.ordem) || 0,
      ativa: form.ativa,
    });
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setForm(vazioForm());
    carregar();
  }

  function editar(f: Forma) {
    setForm({ sync_uid: f.sync_uid, chave: f.chave, de_sistema: f.de_sistema, rotulo: f.rotulo, ordem: String(f.ordem), ativa: f.ativa });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Formas de pagamento</h1>

      <form onSubmit={salvar} className="mt-6 grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="grid gap-1.5">
          <Label htmlFor="rotulo">Rótulo</Label>
          <Input id="rotulo" value={form.rotulo} onChange={(e) => setForm({ ...form, rotulo: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" inputMode="numeric" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} />
          Ativa
        </label>
        {erro && <p className="text-sm text-destructive sm:col-span-2">{erro}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={salvando}>{form.sync_uid ? "Salvar" : "Adicionar"}</Button>
          {form.sync_uid && (
            <Button type="button" variant="secondary" onClick={() => setForm(vazioForm())}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <h2 className="mt-10 text-lg font-semibold">Cadastradas</h2>
      <div className="mt-3">
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio texto="Nenhuma forma cadastrada." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((f) => (
                <TableRow key={f.sync_uid} className="cursor-pointer" onClick={() => editar(f)}>
                  <TableCell className="text-muted-foreground">{f.ordem}</TableCell>
                  <TableCell>
                    {f.rotulo}
                    {f.de_sistema && <Badge variant="secondary" className="ml-2">sistema</Badge>}
                  </TableCell>
                  <TableCell>{f.ativa ? "Ativa" : "Inativa"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
