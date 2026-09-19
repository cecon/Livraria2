import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, House, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@livraria/ui/wowdash/badge";
import { Button } from "@livraria/ui/wowdash/button";
import { Card, CardContent } from "@livraria/ui/wowdash/card";
import { Input } from "@livraria/ui/wowdash/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@livraria/ui/wowdash/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@livraria/ui/wowdash/table";
import { brl } from "@/lib/format";
import { PAG_VAZIO, RASCUNHO_KEY } from "@/lib/venda";
import { excluirPedido, relatorioVendas, type ErroIpc, type PedidoRelatorio, type RelatorioVendas } from "@/lib/ipc";

type Filtro = "todos" | "concluidas" | "divergentes" | "canceladas";

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function valorPago(p: PedidoRelatorio): number {
  return p.recebimentos.reduce((total, item) => total + item.valorCentavos, 0);
}

export function ListaVendas({ onClonar }: { onClonar?: () => void } = {}) {
  const [data, setData] = useState(hojeIso());
  const [rel, setRel] = useState<RelatorioVendas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [porPagina, setPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const [expandida, setExpandida] = useState<number | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setRel(await relatorioVendas(data, "dia"));
      setErro(false);
    } catch {
      setRel(null);
      setErro(true);
    } finally { setCarregando(false); }
  }

  useEffect(() => { void carregar(); }, [data]);

  async function reabrir(p: PedidoRelatorio) {
    if (!window.confirm(`Reabrir a venda Nº ${p.numero}? Ela será cancelada (estoque devolvido) e reaberta no PDV para edição.`)) return;
    try {
      await excluirPedido(p.numero);
      localStorage.setItem(RASCUNHO_KEY, JSON.stringify({
        cliente: p.cliente,
        itens: p.itens.map((item) => ({
          codigo: item.codigo, titulo: item.titulo,
          precoCentavos: Math.round(item.valorCentavos / item.qtd), qtd: item.qtd,
        })),
        pag: PAG_VAZIO,
      }));
      toast.success(`Venda Nº ${p.numero} cancelada e reaberta para edição`);
      onClonar?.();
    } catch (error) { toast.error((error as ErroIpc).mensagem ?? "Erro ao reabrir a venda"); }
  }

  async function cancelar(numero: number) {
    if (!window.confirm(`Cancelar a venda Nº ${numero} inteira?`)) return;
    try {
      await excluirPedido(numero);
      toast.success(`Venda Nº ${numero} cancelada`);
      await carregar();
    } catch (error) { toast.error((error as ErroIpc).mensagem ?? "Erro ao cancelar a venda"); }
  }

  const pedidos = (rel?.pedidos ?? []).filter((p) => {
    const texto = busca.trim().toLocaleLowerCase("pt-BR");
    if (texto && !`${p.numero} ${p.cliente} ${p.itens.map((item) => item.titulo).join(" ")}`.toLocaleLowerCase("pt-BR").includes(texto)) return false;
    if (filtro === "canceladas") return p.cancelado;
    if (filtro === "divergentes") return !p.cancelado && valorPago(p) !== p.totalCentavos;
    if (filtro === "concluidas") return !p.cancelado && valorPago(p) === p.totalCentavos;
    return true;
  });
  const totalPaginas = Math.max(1, Math.ceil(pedidos.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = pedidos.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  return <div className="w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Lista de vendas</h1>
        {rel && !carregando ? <p className="mt-1 text-sm text-muted-foreground">{rel.pedidos.filter((p) => !p.cancelado).length} vendas · Total {brl(rel.resumo.subtotalCentavos)}</p> : null}
      </div>
      <nav aria-label="Navegação da página" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-2 hover:text-brand"><House size={16} /> Início</Link>
        <ChevronRight size={15} aria-hidden="true" /><span className="font-medium text-foreground" aria-current="page">Lista de vendas</span>
      </nav>
    </div>

    <Card className="gap-0 rounded-lg py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor="vendas-por-pagina">Mostrar</label>
          <Select value={String(porPagina)} onValueChange={(value) => { setPorPagina(Number(value)); setPagina(1); }}>
            <SelectTrigger id="vendas-por-pagina" className="h-10 min-w-16"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative min-w-44 flex-1 sm:w-64 sm:flex-none">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Pesquisar vendas" value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }}
              placeholder="Pesquisar venda" className="h-10" style={{ paddingLeft: 40 }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="vendas-data">Data</label>
          <Input id="vendas-data" type="date" value={data} onChange={(event) => { setData(event.currentTarget.value); setPagina(1); }} className="h-10 w-40" />
          <Select value={filtro} onValueChange={(value) => { setFiltro(value as Filtro); setPagina(1); }}>
            <SelectTrigger aria-label="Filtrar por status" className="h-10 min-w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="concluidas">Concluídas</SelectItem>
              <SelectItem value="divergentes">Divergentes</SelectItem>
              <SelectItem value="canceladas">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" title="Atualizar vendas" aria-label="Atualizar vendas" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={carregando ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
      <CardContent className="px-4 py-4 sm:px-6">
        {erro ? <div className="py-12 text-center text-sm"><p>Não foi possível carregar as vendas.</p>
          <Button variant="outline" className="mt-3" onClick={() => void carregar()}><RefreshCw /> Tentar novamente</Button></div> :
        carregando ? <p className="py-12 text-center text-sm text-muted-foreground">Carregando vendas…</p> :
        <Table className="min-w-[780px] border-separate border-spacing-0">
          <TableHeader><TableRow className="border-0">
            {(["Pedido", "Cliente", "Itens", "Total", "Status", "Ações"] as const).map((titulo, index) =>
              <TableHead key={titulo} className={`h-12 border-y border-neutral-200 bg-neutral-100 px-4 dark:border-slate-600 dark:bg-slate-700 ${index === 0 ? "rounded-tl-lg border-l" : ""} ${index === 5 ? "rounded-tr-lg border-r" : ""}`}>{titulo}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {visiveis.length === 0 ? <TableRow><TableCell colSpan={6} className="border-x border-b py-12 text-center text-muted-foreground">Nenhuma venda encontrada nesta data.</TableCell></TableRow> :
              visiveis.map((p) => {
                const divergente = !p.cancelado && valorPago(p) !== p.totalCentavos;
                return <FragmentoVenda key={p.numero} pedido={p} expandido={expandida === p.numero} divergente={divergente}
                  onDetalhes={() => setExpandida(expandida === p.numero ? null : p.numero)} onReabrir={() => void reabrir(p)} onCancelar={() => void cancelar(p.numero)} />;
              })}
          </TableBody>
        </Table>}
        {!erro && !carregando && pedidos.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
          <span>{(paginaAtual - 1) * porPagina + 1}–{Math.min(paginaAtual * porPagina, pedidos.length)} de {pedidos.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Página anterior" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}><ChevronLeft /></Button>
            <span className="min-w-14 text-center">{paginaAtual} / {totalPaginas}</span>
            <Button variant="outline" size="icon" aria-label="Próxima página" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}><ChevronRight /></Button>
          </div>
        </div> : null}
      </CardContent>
    </Card>
  </div>;
}

function FragmentoVenda({ pedido: p, expandido, divergente, onDetalhes, onReabrir, onCancelar }: {
  pedido: PedidoRelatorio; expandido: boolean; divergente: boolean;
  onDetalhes: () => void; onReabrir: () => void; onCancelar: () => void;
}) {
  return <>
    <TableRow className="border-0">
      <TableCell className="border-b border-l px-4 py-3.5 font-medium text-brand">#{p.numero}</TableCell>
      <TableCell className="border-b px-4 py-3.5">{p.cliente || "CLIENTE"}</TableCell>
      <TableCell className="border-b px-4 py-3.5 text-muted-foreground">{p.itens.length}</TableCell>
      <TableCell className="border-b px-4 py-3.5 font-medium tabular-nums">{brl(p.totalCentavos)}</TableCell>
      <TableCell className="border-b px-4 py-3.5"><Badge variant={p.cancelado ? "danger" : divergente ? "warning" : "success"}>
        {p.cancelado ? "Cancelada" : divergente ? "Divergente" : "Concluída"}
      </Badge></TableCell>
      <TableCell className="border-b border-r px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label={`Ver detalhes da venda ${p.numero}`} title="Ver detalhes"
            onClick={onDetalhes} className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-600/20"><Eye /></Button>
          {!p.cancelado ? <>
            <Button variant="ghost" size="icon" aria-label={`Reabrir venda ${p.numero}`} title="Reabrir venda" onClick={onReabrir}
              className="bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-600/20"><RotateCcw /></Button>
            <Button variant="ghost" size="icon" aria-label={`Cancelar venda ${p.numero}`} title="Cancelar venda" onClick={onCancelar}
              className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-600/20"><Trash2 /></Button>
          </> : null}
        </div>
      </TableCell>
    </TableRow>
    {expandido ? <TableRow><TableCell colSpan={6} className="border-x border-b bg-muted/20 px-4 py-4">
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div><h3 className="mb-2 font-semibold">Itens</h3>
          {p.itens.map((item) => <div key={item.id} className="flex justify-between gap-3 border-b py-1.5">
            <span>{item.qtd} × {item.titulo}{item.alocacoes.length ? ` · ${item.alocacoes.map((a) => `${a.qtd} un. ${a.nome}`).join(", ")}` : ""}</span>
            <span className="shrink-0 tabular-nums">{brl(item.valorCentavos)}</span>
          </div>)}
        </div>
        <div><h3 className="mb-2 font-semibold">Pagamentos</h3>
          {p.recebimentos.map((r) => <div key={r.formaId} className="flex justify-between gap-3 border-b py-1.5">
            <span>{r.rotulo}</span><span className="tabular-nums">{brl(r.valorCentavos)}</span>
          </div>)}
          {divergente ? <p className="mt-2 text-amber-700 dark:text-amber-400">Pago {brl(valorPago(p))} · total {brl(p.totalCentavos)}</p> : null}
        </div>
      </div>
    </TableCell></TableRow> : null}
  </>;
}
