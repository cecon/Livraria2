"use client";

import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarFornecedores, salvarFornecedor, type Fornecedor } from "@/lib/nuvem/fornecedor";
import { Carregando, Vazio } from "@/components/estados";

const vazioForm = (): Partial<Fornecedor> => ({ nome: "", documento: "", telefone: "", email: "", ativo: true });

// Fornecedores (US2/T028) — dedup por nome; LWW.
export default function FornecedoresPage() {
  const [lista, setLista] = useState<Fornecedor[] | null>(null);
  const [form, setForm] = useState<Partial<Fornecedor>>(vazioForm());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLista(await listarFornecedores());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome?.trim()) {
      setErro("Informe o nome.");
      return;
    }
    setSalvando(true);
    const { error } = await salvarFornecedor(form as Fornecedor);
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setForm(vazioForm());
    carregar();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Fornecedores</h1>

      <form onSubmit={salvar} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="doc">Documento (CNPJ/CPF)</Label>
          <Input id="doc" value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tel">Telefone</Label>
          <Input id="tel" value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
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

      <h2 className="mt-10 text-lg font-semibold">Cadastrados</h2>
      <div className="mt-3">
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio texto="Nenhum fornecedor cadastrado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((f) => (
                <TableRow key={f.sync_uid} className="cursor-pointer" onClick={() => setForm(f)}>
                  <TableCell>{f.nome}</TableCell>
                  <TableCell>{f.documento ?? "—"}</TableCell>
                  <TableCell>{f.telefone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
