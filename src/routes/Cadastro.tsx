// Tela Cadastro de livro (US2): lookup por código → incluir/alterar/excluir.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import {
  excluirLivro,
  livroPorCodigo,
  livrosRecentes,
  salvarLivro,
  type ErroIpc,
} from "@/lib/ipc";

const FORM_VAZIO = {
  codigo: "",
  codigoBarras: "",
  titulo: "",
  autor: "",
  valor: "",
  estoque: "0",
  categoria: 0,
  descricao: "",
};

export default function Cadastro() {
  const [modo, setModo] = useState<"lookup" | "form">("lookup");
  const [editando, setEditando] = useState(false);
  const [codigoLookup, setCodigoLookup] = useState("");
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [recentes, setRecentes] = useState<Livro[]>([]);
  const lookupRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarRecentes();
    lookupRef.current?.focus();
  }, []);

  function carregarRecentes() {
    livrosRecentes(4).then(setRecentes).catch(() => setRecentes([]));
  }

  function abrirLivro(l: Livro) {
    setForm({
      codigo: l.codigo,
      codigoBarras: l.codigoBarras ?? "",
      titulo: l.titulo,
      autor: l.autor ?? "",
      valor: centavosParaInput(l.precoCentavos),
      estoque: String(l.estoque),
      categoria: l.categoria,
      descricao: l.descricao ?? "",
    });
    setEditando(true);
    setModo("form");
  }

  async function buscar() {
    const cod = codigoLookup.trim();
    if (!cod) return;
    try {
      const l = await livroPorCodigo(cod);
      if (l) {
        abrirLivro(l);
      } else {
        setForm({ ...FORM_VAZIO, codigo: cod });
        setEditando(false);
        setModo("form");
      }
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao buscar");
    }
  }

  function voltarLookup() {
    setModo("lookup");
    setCodigoLookup("");
    setTimeout(() => lookupRef.current?.focus(), 0);
  }

  async function salvar() {
    const precoCentavos = parseBrlParaCentavos(form.valor) ?? 0;
    const livro: Livro = {
      codigo: form.codigo.trim(),
      titulo: form.titulo.trim(),
      autor: form.autor.trim() || null,
      precoCentavos,
      categoria: form.categoria,
      estoque: parseInt(form.estoque, 10) || 0,
      descricao: form.descricao.trim() || null,
      codigoBarras: form.codigoBarras.trim() || null,
    };
    try {
      await salvarLivro(livro);
      toast.success(editando ? "Livro alterado" : "Livro cadastrado");
      carregarRecentes();
      voltarLookup();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao salvar");
    }
  }

  async function excluir() {
    try {
      await excluirLivro(form.codigo);
      toast.success("Livro excluído");
      carregarRecentes();
      voltarLookup();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir");
    }
  }

  if (modo === "lookup") {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cadastro</h1>
        <div className="bg-card mt-4 rounded-xl border p-5">
          <Label htmlFor="cod">Código de Barras</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="cod"
              ref={lookupRef}
              value={codigoLookup}
              autoFocus
              onChange={(e) => setCodigoLookup(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              className="h-9 font-mono"
              placeholder="Escaneie ou digite o código"
            />
            <Button onClick={buscar} className="h-9">
              Cadastrar / Alterar
            </Button>
          </div>
        </div>

        {recentes.length > 0 && (
          <div className="mt-6">
            <div className="text-muted-foreground text-[11px] uppercase">
              Cadastrados recentemente
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {recentes.map((l) => (
                <button
                  key={l.codigo}
                  onClick={() => abrirLivro(l)}
                  className="bg-card hover:bg-muted/50 rounded-lg border p-3 text-left"
                >
                  <div className="truncate text-sm font-medium">{l.titulo}</div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    {l.codigo}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {editando ? "Alterar livro" : "Novo livro"}
      </h1>
      <div className="bg-card mt-4 space-y-4 rounded-xl border p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código (interno)</Label>
            <Input value={form.codigo} disabled className="mt-1 h-9 font-mono" />
          </div>
          <div>
            <Label htmlFor="ean">Código de barras (EAN/ISBN)</Label>
            <Input
              id="ean"
              value={form.codigoBarras}
              onChange={(e) =>
                setForm({ ...form, codigoBarras: e.currentTarget.value })
              }
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
            onChange={(e) =>
              setForm({ ...form, titulo: e.currentTarget.value.toUpperCase() })
            }
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label htmlFor="aut">Autor</Label>
          <Input
            id="aut"
            value={form.autor}
            onChange={(e) =>
              setForm({ ...form, autor: e.currentTarget.value.toUpperCase() })
            }
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
            <Label htmlFor="est">Estoque</Label>
            <Input
              id="est"
              value={form.estoque}
              inputMode="numeric"
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
          <div className="text-muted-foreground mt-1 text-[11px]">
            0 = Não Categorizado
          </div>
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
          <Button
            onClick={salvar}
            className="h-9 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]"
          >
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
          <Button variant="outline" onClick={voltarLookup} className="ml-auto h-9">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
