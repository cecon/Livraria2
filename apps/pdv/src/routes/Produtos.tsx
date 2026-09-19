import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Button } from "@livraria/ui/wowdash/button";
import { Input } from "@livraria/ui/wowdash/input";
import { Card, CardHeader, CardContent, CardFooter } from "@livraria/ui/wowdash/card";
import { ProdutoModal } from "@/components/produtos/ProdutoModal";
import { listarProdutos, consultarProduto, erroProduto, type Produto } from "@/lib/produtos";
import { brl } from "@/lib/format";
export default function Produtos() {
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [novo, setNovo] = useState(false);
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro("");
    listarProdutos(termo, pagina).then((r) => { if (vivo) setProdutos(r); })
      .catch((e) => { if (vivo) setErro(erroProduto(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [termo, pagina, versao]);
  async function editar(codigo: string) {
    if (ocupado) return; setOcupado(true);
    try {
      const r = await consultarProduto(codigo);
      if (!r || r.produto.excluido) throw new Error("Produto não disponível na retaguarda.");
      setSelecionado(r.produto);
    } catch (e) { toast.error(erroProduto(e)); }
    finally { setOcupado(false); }
  }
  function fechar() { setNovo(false); setSelecionado(null); setVersao((v) => v + 1); }
  return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
    <h1 className="text-2xl font-semibold">Produtos</h1>
    <p className="text-sm text-muted-foreground">Consulte os produtos do PDV. Cadastro, edição e estoque exigem conexão com a retaguarda.</p>
    <Card className="gap-0 overflow-hidden rounded-lg border-0 py-0">
      <CardHeader className="flex flex-col gap-3 border-b border-neutral-200 px-4 !py-4 sm:px-6 dark:border-slate-600">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="search" className="relative w-full sm:max-w-sm">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-10" aria-label="Buscar produtos" placeholder="Título, autor ou código"
              value={termo} onChange={(e) => { setTermo(e.target.value); setPagina(0); }} />
          </div>
          <Button className="h-11 w-full sm:w-auto" onClick={() => setNovo(true)}><Plus aria-hidden="true" /> Novo produto</Button>
        </div>
        <Button className="w-full sm:w-auto sm:self-start" variant="outline" disabled={ocupado || !termo.trim()}
          onClick={() => void editar(termo.trim())}>Consultar código na retaguarda</Button>
      </CardHeader>
      <CardContent className="px-0">
    {erro ? <div role="alert" className="flex flex-wrap items-center gap-3 p-5">{erro}<Button variant="outline" onClick={() => setVersao((v) => v + 1)}>Tentar novamente</Button></div> :
      <div className="divide-y" aria-busy={carregando}>
        {carregando ? <p className="p-5">Carregando…</p> : !produtos.length ? <p className="p-5">Nenhum produto encontrado.</p> :
          produtos.slice(0,20).map((p) => <div key={p.uid} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><p className="break-words font-medium">{p.titulo}</p><p className="text-xs text-muted-foreground">{p.codigo} · {p.ativo ? "Ativo" : "Inativo"}</p></div>
            <div className="flex flex-wrap items-center gap-3 text-sm"><span>{brl(p.precoCentavos)}</span><span>Estoque: {p.saldoPublicado}</span>
              <Button variant="outline" disabled={ocupado} onClick={() => void editar(p.codigo)}>Editar</Button></div>
          </div>)}
      </div>}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-3 border-t px-4 !py-4 sm:px-6">
        <Button variant="outline" disabled={!pagina || carregando} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">Página {pagina + 1}</span>
        <Button variant="outline" disabled={produtos.length < 21 || carregando} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
      </CardFooter>
    </Card>
    {(novo || selecionado) && <ProdutoModal inicial={selecionado} onFechar={fechar} onSalvo={(r) => {
      toast.success(r.produto.ativo ? "Produto salvo e disponível no PDV." : "Produto salvo como inativo. Confira o estoque antes de vender."); fechar();
    }} />}
  </div>;
}
