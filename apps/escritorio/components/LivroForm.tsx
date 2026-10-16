"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import { Textarea } from "@livraria/ui/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/ui/select";
import { AjusteEstoque } from "@/components/AjusteEstoque";
import { CATEGORIAS } from "@/lib/catalogo";
import { salvarLivro, type Livro } from "@/lib/nuvem/livro";
import { saldoLivro } from "@/lib/nuvem/estoque";
import { centavos } from "@/utils/texto";

const centsInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

// Formulário de livro (tela separada) — paridade com o LivroForm do PDV. Ao alterar
// um livro, mostra o saldo oficial e permite ajustá-lo (feature 014). O ajuste é
// independente: não salva nem descarta as edições pendentes do formulário.
export function LivroForm({ inicial, onSalvo, onCancelar }: { inicial: Livro | null; onSalvo: () => void; onCancelar: () => void }) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => ({
    codigo: inicial?.codigo ?? "",
    titulo: inicial?.titulo ?? "",
    autor: inicial?.autor ?? "",
    valor: inicial ? centsInput(inicial.preco_centavos) : "",
    estoque: "0",
    categoria: inicial?.categoria ?? 0,
    descricao: inicial?.descricao ?? "",
  }));
  const [salvando, setSalvando] = useState(false);
  const [saldo, setSaldo] = useState<number | null>(null);

  const livroUid = inicial?.sync_uid;
  const recarregarSaldo = useCallback(async () => {
    if (livroUid) setSaldo(await saldoLivro(livroUid));
  }, [livroUid]);
  useEffect(() => {
    recarregarSaldo();
  }, [recarregarSaldo]);

  async function salvar() {
    if (!form.codigo.trim()) return toast.error("Informe o código (de barras) do livro");
    setSalvando(true);
    const { error } = await salvarLivro({
      sync_uid: inicial?.sync_uid,
      codigo: form.codigo,
      titulo: form.titulo,
      autor: form.autor,
      preco_centavos: centavos(form.valor),
      categoria: form.categoria,
      descricao: form.descricao,
      estoqueInicial: editando ? undefined : parseInt(form.estoque, 10) || 0,
    });
    setSalvando(false);
    if (error) return toast.error(error);
    toast.success(editando ? "Livro alterado" : "Livro cadastrado");
    onSalvo();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{editando ? "Alterar livro" : "Novo livro"}</h1>

      <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
        <div>
          <Label htmlFor="cod">Código de barras (EAN/ISBN)</Label>
          <Input id="cod" value={form.codigo} disabled={editando} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} className="mt-1 h-9 font-mono" placeholder="ex.: 9788573671469" />
        </div>
        <div>
          <Label htmlFor="tit">Título</Label>
          <Input id="tit" value={form.titulo} autoFocus onChange={(e) => setForm({ ...form, titulo: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div>
          <Label htmlFor="aut">Autor</Label>
          <Input id="aut" value={form.autor ?? ""} onChange={(e) => setForm({ ...form, autor: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="val">Valor (R$)</Label>
            <Input id="val" value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setForm({ ...form, valor: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>
          <div>
            <Label htmlFor="est">{editando ? "Estoque atual" : "Estoque inicial"}</Label>
            <Input id="est" value={editando ? (saldo === null ? "…" : String(saldo)) : form.estoque} inputMode="numeric" disabled={editando} onChange={(e) => setForm({ ...form, estoque: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>
        </div>
        {editando && livroUid && saldo !== null && (
          <div className="-mt-2 flex flex-col items-end">
            <AjusteEstoque livroUid={livroUid} saldoAtual={saldo} onAjustado={recarregarSaldo} onSaldoAtualizado={setSaldo} />
          </div>
        )}
        <div>
          <Label>Categoria</Label>
          <Select value={String(form.categoria)} onValueChange={(v) => setForm({ ...form, categoria: Number(v) })}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.id} — {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} className="mt-1" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando} className="h-9 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">
            {editando ? "Alterar" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} className="ml-auto h-9">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
