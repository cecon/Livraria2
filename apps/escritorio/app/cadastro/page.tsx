"use client";

import { useEffect, useState } from "react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/ui/table";
import { listarLivros, salvarLivro, type Livro } from "@/lib/nuvem/livro";
import { centavos, reais } from "@/utils/texto";
import { Carregando, Vazio } from "@/components/estados";

const vazioForm = () => ({
  sync_uid: undefined as string | undefined,
  codigo: "",
  titulo: "",
  autor: "",
  preco: "",
  categoria: 0,
  ativo: true,
});

// Cadastro / preço de livro (US2/T025) — dedup por código de barras; LWW.
export default function CadastroPage() {
  const [lista, setLista] = useState<Livro[] | null>(null);
  const [form, setForm] = useState(vazioForm());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLista(await listarLivros());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.codigo.trim() || !form.titulo.trim()) {
      setErro("Código de barras e título são obrigatórios.");
      return;
    }
    setSalvando(true);
    const { error } = await salvarLivro({
      sync_uid: form.sync_uid,
      codigo: form.codigo,
      titulo: form.titulo,
      autor: form.autor,
      preco_centavos: centavos(form.preco),
      categoria: Number(form.categoria) || 0,
      ativo: form.ativo,
    });
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setForm(vazioForm());
    carregar();
  }

  function editar(l: Livro) {
    setForm({
      sync_uid: l.sync_uid,
      codigo: l.codigo,
      titulo: l.titulo,
      autor: l.autor ?? "",
      preco: (l.preco_centavos / 100).toString().replace(".", ","),
      categoria: l.categoria,
      ativo: l.ativo,
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Cadastro / preço de livros</h1>

      <form onSubmit={salvar} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="codigo">Código de barras</Label>
          <Input id="codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="autor">Autor</Label>
          <Input id="autor" value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="preco">Preço (R$)</Label>
          <Input id="preco" inputMode="decimal" placeholder="0,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
        </div>
        {erro && <p className="text-sm text-destructive sm:col-span-2">{erro}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={salvando}>
            {form.sync_uid ? "Salvar" : "Adicionar"}
          </Button>
          {form.sync_uid && (
            <Button type="button" variant="secondary" onClick={() => setForm(vazioForm())}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <h2 className="mt-10 text-lg font-semibold">Acervo</h2>
      <div className="mt-3">
        {lista === null ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio texto="Nenhum livro cadastrado ainda." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((l) => (
                <TableRow key={l.sync_uid} className="cursor-pointer" onClick={() => editar(l)}>
                  <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                  <TableCell>{l.titulo}</TableCell>
                  <TableCell className="text-right">{reais(l.preco_centavos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
