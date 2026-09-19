import { useRef, useState } from "react";
import { Button } from "@livraria/ui/wowdash/button";
import { Input } from "@livraria/ui/wowdash/input";
import { Label } from "@livraria/ui/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@livraria/ui/ui/dialog";
import { AutorizacaoAdmin } from "@livraria/ui/ui/autorizacao-admin";
import { ProdutoCampos, novoFormProduto, validarProduto, lerInteiro, type FormProduto } from "@livraria/ui/ui/produto-campos";
import { consultarProduto, salvarProduto, erroProduto, type Produto, type PedidoProduto, type ProdutoResposta } from "@/lib/produtos";
import { toast } from "sonner";

type Pendente = { pedido: PedidoProduto; confirmado?: boolean };
function pendencia(key: string): Pendente | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}
function formInicial(p: Produto | null, codigo: string, pending: Pendente | null): FormProduto {
  const d = pending?.pedido.dados;
  if (d) return { codigo: d.codigo, titulo: d.titulo, autor: d.autor, descricao: d.descricao,
    categoria: String(d.categoria), estoque: String(d.estoqueInicial),
    valor: `${Math.trunc(d.preco_centavos / 100)},${String(d.preco_centavos % 100).padStart(2, "0")}` };
  if (!p) return novoFormProduto(codigo);
  return { codigo: p.codigo, titulo: p.titulo, autor: p.autor ?? "", descricao: p.descricao ?? "",
    categoria: String(p.categoria), estoque: "0",
    valor: `${Math.trunc(p.precoCentavos / 100)},${String(p.precoCentavos % 100).padStart(2, "0")}` };
}
export function ProdutoModal({ inicial = null, codigo = "", venda = false, onSalvo, onFechar }: {
  inicial?: Produto | null; codigo?: string; venda?: boolean;
  onSalvo: (r: ProdutoResposta) => void; onFechar: () => void;
}) {
  const key = `produto-pendente-${inicial?.uid ?? (codigo || "novo")}`;
  const [pending, setPending] = useState(() => pendencia(key));
  const [produto, setProduto] = useState(inicial);
  const [form, setForm] = useState(() => formInicial(inicial, codigo, pending));
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [contando, setContando] = useState(pending?.pedido.acao === "contar");
  const [quantidade, setQuantidade] = useState(String(pending?.pedido.quantidade ?? inicial?.saldoPublicado ?? 0));
  const [auth, setAuth] = useState({ usuario: "", senha: "" });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  function guardar(value: Pendente | null) {
    if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key);
    setPending(value);
  }
  async function atualizar() {
    if (!produto || trava.current) return;
    trava.current = true; setOcupado(true);
    try {
      const r = await consultarProduto(undefined, produto.uid);
      if (!r || r.produto.excluido) throw new Error("Produto indisponível na retaguarda.");
      setProduto(r.produto); setErro(""); setContando(true);
      setQuantidade(String(Math.max(0, r.produto.saldoPublicado)));
    } catch (e) { setErro(erroProduto(e)); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function salvar() {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro("");
    try {
      let tentativa = pending;
      if (!tentativa) {
        let pedido: PedidoProduto;
        if (contando && produto) pedido = { operacao: crypto.randomUUID(), uid: produto.uid,
          acao: "contar", versao: produto.versao, quantidade: lerInteiro(quantidade) };
        else {
          const d = validarProduto(form);
          pedido = { operacao: crypto.randomUUID(), uid: produto?.uid ?? crypto.randomUUID(),
            acao: produto ? "editar" : "criar", versao: produto?.versao,
            dados: { codigo: d.codigo, titulo: d.titulo, autor: d.autor ?? "", descricao: d.descricao ?? "",
              preco_centavos: d.precoCentavos, categoria: d.categoria, estoqueInicial: produto ? 0 : d.estoqueInicial,
              ...(produto ? { ativo } : {}) } };
        }
        tentativa = { pedido }; guardar(tentativa);
      }
      const r = tentativa.confirmado ? await consultarProduto(undefined, tentativa.pedido.uid)
        : await salvarProduto(tentativa.pedido, auth);
      if (!r) throw new Error("Não foi possível recuperar o produto.");
      if (r.pendenteLocal) {
        guardar({ ...tentativa, confirmado: true });
        setErro("Salvo na retaguarda. Tente novamente para disponibilizar neste PDV.");
        return;
      }
      guardar(null);
      if (tentativa.pedido.acao === "contar") {
        setProduto(r.produto); setAtivo(r.produto.ativo); setContando(false);
        toast.success("Contagem registrada. Estoque atualizado.");
      } else {
        onSalvo(r);
      }
    } catch (e) {
      const code = (e as { codigo?: string }).codigo;
      if (["SEM_PERMISSAO", "DADOS_INVALIDOS", "CONFLITO", "PRODUTO_ALTERADO"].includes(code ?? "")) guardar(null);
      if (code === "PRODUTO_ALTERADO" && produto) {
        try { const atual = await consultarProduto(undefined, produto.uid); if (atual) setProduto(atual.produto); }
        catch { /* mantém prévia; servidor continua recusando versão antiga */ }
      }
      setErro(erroProduto(e));
    } finally { trava.current = false; setOcupado(false); setAuth((a) => ({ ...a, senha: "" })); }
  }
  let total: number | null = null;
  try { total = lerInteiro(quantidade); } catch { /* mensagem no envio */ }
  return <Dialog open onOpenChange={(open) => { if (!open && !ocupado) onFechar(); }}>
    <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => { if (ocupado) e.preventDefault(); }}>
      <DialogTitle className="text-lg font-semibold">{contando ? "Ajustar estoque" : produto ? "Editar produto" : "Novo produto"}</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">
        {contando ? "Informe o total físico. A diferença será registrada como inventário deste produto." : "As alterações são salvas na retaguarda. É necessário estar conectado."}
      </DialogDescription>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        {contando ? <>
          <Label htmlFor="total-contado">Quantidade física contada</Label>
          <Input id="total-contado" inputMode="numeric" value={quantidade} disabled={ocupado || !!pending}
            onChange={(e) => setQuantidade(e.target.value)} required />
          <p className="rounded-md bg-muted p-3 text-sm">Saldo: {produto?.saldoPublicado} · Total contado: {total ?? "—"} · Diferença: {total !== null && produto ? total - produto.saldoPublicado : "—"}</p>
        </> : <>
          <ProdutoCampos value={form} onChange={setForm} disabled={ocupado || !!pending} editando={!!produto} />
          {produto && <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span>Estoque: {produto.saldoPublicado}</span>
              <Button type="button" variant="outline" disabled={ocupado || !!pending} onClick={() => void atualizar()}>Ajustar estoque</Button></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} disabled={ocupado || !!pending} onChange={(e) => setAtivo(e.target.checked)} />Ativo para venda</label>
          </div>}
          {!produto && <p className="text-xs text-muted-foreground">Informe estoque inicial positivo para disponibilizar o produto para venda.</p>}
        </>}
        {!pending?.confirmado && <AutorizacaoAdmin value={auth} onChange={setAuth} disabled={ocupado} />}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        {pending && !pending.confirmado && <p className="text-xs text-muted-foreground">Tentativa pendente. Reenvie os mesmos dados para conferir o resultado.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => {
            if (contando && !pending) { setContando(false); setErro(""); setAuth({ usuario: "", senha: "" }); }
            else onFechar();
          }}>Cancelar</Button>
          <Button type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : pending?.confirmado ? "Disponibilizar no PDV" : contando ? "Confirmar ajuste" : venda ? "Salvar e adicionar à venda" : "Salvar"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
