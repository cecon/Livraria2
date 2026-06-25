// Formulário de fornecedor (incluir/alterar) — US1.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fornecedorSalvar, type ErroIpc } from "@/lib/ipc";
import type { Fornecedor } from "@/lib/types";

interface Props {
  inicial: Fornecedor | null; // null = novo
  onSalvo: () => void;
  onCancelar: () => void;
}

function doForn(f: Fornecedor | null) {
  return {
    id: f?.id ?? 0,
    nome: f?.nome ?? "",
    documento: f?.documento ?? "",
    telefone: f?.telefone ?? "",
    email: f?.email ?? "",
    observacoes: f?.observacoes ?? "",
  };
}

export function FornecedorForm({ inicial, onSalvo, onCancelar }: Props) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => doForn(inicial));

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    try {
      await fornecedorSalvar({
        id: form.id || undefined,
        nome: form.nome.trim(),
        documento: form.documento.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        observacoes: form.observacoes.trim() || null,
      });
      toast.success(editando ? "Fornecedor alterado" : "Fornecedor cadastrado");
      onSalvo();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao salvar");
    }
  }

  return (
    <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          value={form.nome}
          autoFocus
          onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
          className="mt-1 h-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="doc">Documento (CNPJ/CPF)</Label>
          <Input
            id="doc"
            value={form.documento}
            onChange={(e) => setForm({ ...form, documento: e.currentTarget.value })}
            className="mt-1 h-9 font-mono"
            placeholder="opcional"
          />
        </div>
        <div>
          <Label htmlFor="tel">Telefone</Label>
          <Input
            id="tel"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.currentTarget.value })}
            className="mt-1 h-9"
            placeholder="opcional"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="mail">E-mail</Label>
        <Input
          id="mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          className="mt-1 h-9"
          placeholder="opcional"
        />
      </div>
      <div>
        <Label htmlFor="obs">Observações</Label>
        <Textarea
          id="obs"
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.currentTarget.value })}
          className="mt-1"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={salvar} className="h-9 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">
          {editando ? "Alterar" : "Cadastrar"}
        </Button>
        <Button variant="outline" onClick={onCancelar} className="ml-auto h-9">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
