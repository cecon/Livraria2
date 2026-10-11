"use client";
import { Checkbox } from "@mui/material";
import { useState } from "react";
import { toast } from "sonner";
import { ImagemProduto } from "@/interface/ImagemProduto";
import { Button } from "@/interface/ui/button";
import { Input } from "@/interface/ui/input";
import { Label } from "@/interface/ui/label";
import { Textarea } from "@/interface/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/interface/ui/select";
import { AjusteEstoque } from "@/components/AjusteEstoque";
import { ContentPanel } from "@/components/ContentPanel";
import { PageHeader } from "@/components/PageHeader";
import { StockBadge } from "@/components/StockBadge";
import { CATEGORIAS } from "@/lib/catalogo";
import { salvarLivro, type Livro } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { centavos } from "@/utils/texto";

const centsInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

// Formulário de livro (tela separada) — paridade com o LivroForm do PDV.
export function LivroForm({ inicial, saldo: saldoInicial, onSalvo, onCancelar }: {
  inicial: Livro | null; saldo: number | null; onSalvo: () => void; onCancelar: () => void;
}) {
  const editando = inicial !== null;
  const [form, setForm] = useState(() => ({
    codigo: inicial?.codigo ?? "",
    titulo: inicial?.titulo ?? "",
    autor: inicial?.autor ?? "",
    valor: inicial ? centsInput(inicial.preco_centavos) : "",
    estoque: "0",
    categoria: inicial?.categoria ?? 0,
    descricao: inicial?.descricao ?? "",
    ativo: inicial?.ativo ?? true,
  }));
  const [capaUid, setCapaUid] = useState(inicial?.capaUid ?? null);
  const [imagemOcupada, setImagemOcupada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [saldo, setSaldo] = useState(saldoInicial);

  async function recarregarSaldo() {
    if (!inicial) return;
    try {
      setSaldo((await listarSaldos()).get(inicial.sync_uid) ?? 0);
    } catch {
      toast.error("Ajuste registrado, mas não foi possível atualizar o saldo exibido.");
    }
  }

  async function salvar() {
    if (salvando || imagemOcupada) return;
    if (!form.codigo.trim()) return toast.error("Informe o código (de barras) do livro");
    setSalvando(true);
    const { error } = await salvarLivro({
      capaUid, sync_uid: inicial?.sync_uid,
      codigo: form.codigo,
      titulo: form.titulo,
      autor: form.autor,
      preco_centavos: centavos(form.valor),
      categoria: form.categoria,
      descricao: form.descricao,
      ativo: editando ? form.ativo : undefined,
      estoqueInicial: editando ? undefined : parseInt(form.estoque, 10) || 0,
    });
    setSalvando(false);
    if (error) return toast.error(error);
    toast.success(editando ? "Livro alterado" : parseInt(form.estoque, 10) > 0 ? "Livro cadastrado" : "Livro cadastrado como inativo. Ative na lista de inativos ou adicione a um lançamento.");
    onSalvo();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:p-6 lg:py-7">
      <PageHeader
        title={editando ? "Alterar livro" : "Novo livro"}
        description={editando ? "Atualize os dados comerciais e bibliográficos." : "Inclua um novo título no catálogo da livraria."}
        crumbs={[{ label: "Livros", onClick: onCancelar }, { label: editando ? "Alterar" : "Novo" }]}
        back={{ label: "Voltar para livros", onClick: onCancelar }}
      />

      {editando && inicial && (
        <ContentPanel title="Estoque" description="Saldo atual na nuvem. Ajustes viram movimentos com motivo e chegam aos caixas na próxima sincronização.">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl tabular-nums" aria-label="Saldo atual">{saldo ?? "—"}</span>
              {saldo !== null && <StockBadge estoque={saldo} />}
            </div>
            <AjusteEstoque livroUid={inicial.sync_uid} onAjustado={recarregarSaldo} />
          </div>
        </ContentPanel>
      )}

      <ContentPanel title="Dados do livro" description="Campos usados na pesquisa, venda e sincronização com os caixas.">
        <div className="admin-form space-y-4">
        <ImagemProduto value={capaUid} titulo={form.titulo} disabled={salvando || imagemOcupada} onChange={setCapaUid} onBusy={setImagemOcupada} />
        <div>
          <Label htmlFor="cod">Código de barras (EAN/ISBN)</Label>
          <Input id="cod" value={form.codigo} aria-describedby={editando ? "cod-ajuda" : undefined} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} className="mt-1 h-9 font-mono" placeholder="ex.: 9788573671469" />
          {editando && <p id="cod-ajuda" className="mt-1 text-[11px] text-muted-foreground">Alterar o código mantém vendas e estoque do produto. Etiquetas com o código antigo deixam de ser lidas após a sincronização dos caixas.</p>}
        </div>
        <div>
          <Label htmlFor="tit">Título</Label>
          <Input id="tit" value={form.titulo} autoFocus onChange={(e) => setForm({ ...form, titulo: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div>
          <Label htmlFor="aut">Autor</Label>
          <Input id="aut" value={form.autor ?? ""} onChange={(e) => setForm({ ...form, autor: e.currentTarget.value.toUpperCase() })} className="mt-1 h-9" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="val">Valor (R$)</Label>
            <Input id="val" value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setForm({ ...form, valor: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>
          {!editando && <div>
            <Label htmlFor="est">Estoque inicial</Label>
            <Input id="est" value={form.estoque} inputMode="numeric" onChange={(e) => setForm({ ...form, estoque: e.currentTarget.value })} className="mt-1 h-9 font-mono" />
          </div>}
        </div>
        <div>
          <Label htmlFor="categoria">Categoria</Label>
          <Select value={String(form.categoria)} onValueChange={(v) => setForm({ ...form, categoria: Number(v) })}>
            <SelectTrigger id="categoria" className="mt-1 h-10">
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
        {editando && <label className="flex items-center gap-2 text-sm">
          <Checkbox size="small" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })} />
          Ativo no catálogo e no PDV
        </label>}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando || imagemOcupada} className="h-10">
            {editando ? "Alterar" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} className="h-10 sm:ml-auto">
            Cancelar
          </Button>
        </div>
        </div>
      </ContentPanel>
    </div>
  );
}
