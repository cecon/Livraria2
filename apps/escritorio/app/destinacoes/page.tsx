"use client";

import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Badge } from "@livraria/ui/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarDestinacoes, salvarDestinacao, type Destinacao } from "@/lib/nuvem/destinacao";
import { Carregando, Vazio } from "@/components/estados";

type FormState = { sync_uid?: string; de_sistema?: boolean; nome: string; ordem: string; ativa: boolean };
const vazioForm = (): FormState => ({ nome: "", ordem: "0", ativa: true });

// Destinações / fundos de doação (US2/T030) — dedup por nome; LWW. As de sistema
// (ex.: "Loja") preservam a identidade ao editar (upsert por sync_uid).
export default function DestinacoesPage() {
  const [lista, setLista] = useState<Destinacao[] | null>(null);
  const [form, setForm] = useState<FormState>(vazioForm());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLista(await listarDestinacoes());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    setSalvando(true);
    const { error } = await salvarDestinacao({
      sync_uid: form.sync_uid,
      de_sistema: form.de_sistema,
      nome: form.nome,
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

  function editar(d: Destinacao) {
    setForm({ sync_uid: d.sync_uid, de_sistema: d.de_sistema, nome: d.nome, ordem: String(d.ordem), ativa: d.ativa });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Destinações</h1>

      <form onSubmit={salvar} className="mt-6 grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
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
          <Vazio texto="Nenhuma destinação cadastrada." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((d) => (
                <TableRow key={d.sync_uid} className="cursor-pointer" onClick={() => editar(d)}>
                  <TableCell className="text-muted-foreground">{d.ordem}</TableCell>
                  <TableCell>
                    {d.nome}
                    {d.de_sistema && <Badge variant="secondary" className="ml-2">sistema</Badge>}
                  </TableCell>
                  <TableCell>{d.ativa ? "Ativa" : "Inativa"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
