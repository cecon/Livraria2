// Formulário de livro (incluir/alterar/excluir) — US2. Usado pela tela Cadastro.

import { useState } from "react";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS, type Livro } from "@/lib/types";
import { centavosParaInput, parseBrlParaCentavos } from "@/lib/format";
import { excluirLivro, salvarLivro, type ErroIpc } from "@/lib/ipc";

interface Props {
  inicial: Livro | null; // null = novo livro
  onSalvo: () => void;
  onCancelar: () => void;
}

function doLivro(l: Livro | null) {
  return {
    codigo: l?.codigo ?? "",
    codigoBarras: l?.codigoBarras ?? "",
    titulo: l?.titulo ?? "",
    autor: l?.autor ?? "",
    valor: l ? centavosParaInput(l.precoCentavos) : "",
    estoque: l ? String(l.estoque) : "0",
    categoria: l?.categoria ?? 0,
    descricao: l?.descricao ?? "",
  };
}

export function LivroForm({ inicial, onSalvo, onCancelar }: Props) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => doLivro(inicial));
  const [ajuda, setAjuda] = useState(false);

  async function salvar() {
    if (!form.codigo.trim()) {
      toast.error("Informe o código (interno) do livro");
      return;
    }
    const livro: Livro = {
      codigo: form.codigo.trim(),
      titulo: form.titulo.trim(),
      autor: form.autor.trim() || null,
      precoCentavos: parseBrlParaCentavos(form.valor) ?? 0,
      categoria: form.categoria,
      estoque: parseInt(form.estoque, 10) || 0,
      descricao: form.descricao.trim() || null,
      codigoBarras: form.codigoBarras.trim() || null,
    };
    try {
      await salvarLivro(livro);
      toast.success(editando ? "Livro alterado" : "Livro cadastrado");
      onSalvo();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao salvar");
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir "${form.titulo}"?`)) return;
    try {
      await excluirLivro(form.codigo);
      toast.success("Livro excluído");
      onSalvo();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir");
    }
  }

  return (
    <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cod">Código (interno)</Label>
          <Input
            id="cod"
            value={form.codigo}
            disabled={editando}
            onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            className="mt-1 h-9 font-mono"
            placeholder="ex.: 9788573671469"
          />
        </div>
        <div>
          <Label htmlFor="ean">Código de barras (EAN/ISBN)</Label>
          <Input
            id="ean"
            value={form.codigoBarras}
            onChange={(e) => setForm({ ...form, codigoBarras: e.currentTarget.value })}
            className="mt-1 h-9 font-mono"
            placeholder="opcional"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="tit">Título</Label>
        <Input
          id="tit"
          value={form.titulo}
          autoFocus
          onChange={(e) => setForm({ ...form, titulo: e.currentTarget.value.toUpperCase() })}
          className="mt-1 h-9"
        />
      </div>
      <div>
        <Label htmlFor="aut">Autor</Label>
        <Input
          id="aut"
          value={form.autor}
          onChange={(e) => setForm({ ...form, autor: e.currentTarget.value.toUpperCase() })}
          className="mt-1 h-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="val">Valor (R$)</Label>
          <Input
            id="val"
            value={form.valor}
            inputMode="decimal"
            placeholder="0,00"
            onChange={(e) => setForm({ ...form, valor: e.currentTarget.value })}
            className="mt-1 h-9 font-mono"
          />
        </div>
        <div>
          <div className="relative flex items-center gap-1">
            <Label htmlFor="est">{editando ? "Estoque atual" : "Estoque inicial"}</Label>
            {editando && (
              <button
                type="button"
                onClick={() => setAjuda((v) => !v)}
                onBlur={() => setAjuda(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Sobre o estoque"
              >
                <HelpCircle size={13} />
              </button>
            )}
            {ajuda && (
              <div className="bg-popover text-popover-foreground absolute top-6 left-0 z-30 w-72 rounded-md border p-2 text-xs shadow-md">
                O estoque é controlado pela razão de movimentos. Para alterá-lo, use
                Entrada (compra), Ajuste (perda/correção) ou Inventário — assim a
                mudança fica registrada no extrato do livro.
              </div>
            )}
          </div>
          <Input
            id="est"
            value={form.estoque}
            inputMode="numeric"
            disabled={editando}
            onChange={(e) => setForm({ ...form, estoque: e.currentTarget.value })}
            className="mt-1 h-9 font-mono"
          />
        </div>
      </div>
      <div>
        <Label>Categoria</Label>
        <Select
          value={String(form.categoria)}
          onValueChange={(v) => setForm({ ...form, categoria: Number(v) })}
        >
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
        <Textarea
          id="desc"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
          className="mt-1"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={salvar} className="h-9 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]">
          {editando ? "Alterar" : "Cadastrar"}
        </Button>
        {editando && (
          <Button
            variant="ghost"
            onClick={excluir}
            className="h-9 text-rose-500 hover:text-rose-600"
          >
            Excluir
          </Button>
        )}
        <Button variant="outline" onClick={onCancelar} className="ml-auto h-9">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
