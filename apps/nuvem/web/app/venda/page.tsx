"use client";

// Venda (checkout) no Escritório (feature 009, US2). Espelha o fluxo do PDV:
// busca item → carrinho → formas de pagamento → concluir. Exige turno aberto
// (FR-002); baixa/custo/troco vêm do domínio via WASM (paridade com o PDV).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, ShoppingCart } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { EntradaProduto, type LivroBusca } from "@/components/EntradaProduto";
import { Carrinho } from "@/components/Carrinho";
import { FormasPagamento } from "@/components/FormasPagamento";
import { VendaConcluida } from "@/components/VendaConcluida";
import { parseBRLInput } from "@/lib/brl";
import { reais } from "@/utils/texto";
import { listarLivros } from "@/lib/nuvem/livro";
import { listarSaldos } from "@/lib/nuvem/estoque";
import { listarFormas, type Forma } from "@/lib/nuvem/forma";
import { turnoAberto, type TurnoAberto } from "@/lib/nuvem/turno";
import { registrarVenda, listarVendasDoDia, type ItemVenda, type VendaResultado, type VendaResumo } from "@/lib/nuvem/venda";

export default function VendaPage() {
  const [carregando, setCarregando] = useState(true);
  const [turno, setTurno] = useState<TurnoAberto | null>(null);
  const [livros, setLivros] = useState<LivroBusca[]>([]);
  const [formas, setFormas] = useState<Forma[]>([]);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [valores, setValores] = useState<Map<string, string>>(new Map());
  const [busca, setBusca] = useState("");
  const [concluida, setConcluida] = useState<VendaResultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aba, setAba] = useState<"venda" | "lista">("venda");
  const [vendasDia, setVendasDia] = useState<VendaResumo[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function carregarBase() {
    setCarregando(true);
    try {
      const [t, ls, saldos, fs] = await Promise.all([turnoAberto(), listarLivros(), listarSaldos(), listarFormas()]);
      setTurno(t);
      setLivros(ls.map((l) => ({ sync_uid: l.sync_uid, codigo: l.codigo, titulo: l.titulo, autor: l.autor, preco_centavos: l.preco_centavos, estoque: saldos.get(l.sync_uid) ?? 0 })));
      setFormas(fs.filter((f) => f.ativa));
    } catch {
      toast.error("Falha ao carregar. Verifique o login.");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    carregarBase();
  }, []);

  const totalCentavos = useMemo(() => itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0), [itens]);
  const pagoCentavos = useMemo(() => [...valores.values()].reduce((s, v) => s + parseBRLInput(v), 0), [valores]);

  function adicionar(l: LivroBusca) {
    setItens((prev) => {
      const ex = prev.find((i) => i.codigo === l.codigo);
      if (ex) return prev.map((i) => (i.codigo === l.codigo ? { ...i, qtd: i.qtd + 1 } : i));
      return [...prev, { livroUid: l.sync_uid, codigo: l.codigo, titulo: l.titulo, precoCentavos: l.preco_centavos, qtd: 1 }];
    });
    setBusca("");
    inputRef.current?.focus();
  }
  function codigoExato() {
    const l = livros.find((x) => x.codigo === busca.trim());
    if (l) adicionar(l);
    else toast.error("Livro não encontrado.");
  }
  function alterarQtd(codigo: string, delta: number) {
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)));
  }
  function remover(codigo: string) {
    setItens((prev) => prev.filter((i) => i.codigo !== codigo));
  }
  function setValor(uid: string, v: string) {
    setValores((prev) => new Map(prev).set(uid, v));
  }

  async function concluir() {
    if (!turno) return;
    setOcupado(true);
    const pagamentos = formas
      .map((f) => ({ formaUid: f.sync_uid, valorCentavos: parseBRLInput(valores.get(f.sync_uid) ?? "") }))
      .filter((p) => p.valorCentavos > 0);
    const { error, resultado } = await registrarVenda({ turnoUid: turno.sync_uid, itens, pagamentos });
    setOcupado(false);
    if (error) return toast.error(error);
    setConcluida(resultado!);
    setItens([]);
    setValores(new Map());
    carregarBase();
  }

  function novaVenda() {
    setConcluida(null);
    inputRef.current?.focus();
  }

  if (carregando) return <div className="p-6 text-muted-foreground text-sm">Carregando…</div>;

  if (!turno) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="bg-card space-y-3 rounded-lg border p-6 text-center">
          <Clock className="text-muted-foreground mx-auto" size={40} />
          <div className="font-medium">Nenhum turno aberto</div>
          <p className="text-muted-foreground text-sm">Abra um turno antes de registrar vendas.</p>
          <Button asChild className="h-9">
            <Link href="/turnos">Abrir turno</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (concluida) {
    return (
      <div className="p-6">
        <VendaConcluida resultado={concluida} onNova={novaVenda} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShoppingCart size={20} /> Venda
        </h1>
        <div className="flex gap-1 text-sm">
          <Aba ativa={aba === "venda"} onClick={() => setAba("venda")}>Venda</Aba>
          <Aba ativa={aba === "lista"} onClick={() => { setAba("lista"); listarVendasDoDia().then(setVendasDia); }}>Lista de vendas</Aba>
        </div>
      </div>

      {aba === "lista" ? (
        <ListaVendas vendas={vendasDia} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <EntradaProduto value={busca} onChange={setBusca} onSelecionar={adicionar} onCodigoExato={codigoExato} inputRef={inputRef} livros={livros} />
            <div className="bg-card rounded-lg border p-3">
              <Carrinho itens={itens} onQtd={alterarQtd} onRemover={remover} />
            </div>
          </div>
          <div className="bg-card space-y-4 rounded-lg border p-4">
            <FormasPagamento formas={formas} valores={valores} onValor={setValor} totalCentavos={totalCentavos} pagoCentavos={pagoCentavos} />
            <Button onClick={concluir} disabled={ocupado || itens.length === 0} className="h-10 w-full">
              Concluir venda · {reais(totalCentavos)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Aba({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 ${ativa ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}>
      {children}
    </button>
  );
}

function ListaVendas({ vendas }: { vendas: VendaResumo[] }) {
  if (vendas.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma venda hoje.</p>;
  return (
    <div className="bg-card divide-y rounded-lg border">
      {vendas.map((v) => (
        <div key={v.sync_uid} className={`flex items-center justify-between p-2 text-sm ${v.cancelado ? "opacity-50 line-through" : ""}`}>
          <span className="text-muted-foreground">Nº {v.numeroNoTurno ?? v.numero}</span>
          <span className="flex-1 px-3 truncate">{v.cliente}</span>
          <span className="tabular-nums font-medium">{reais(v.totalCentavos)}</span>
        </div>
      ))}
    </div>
  );
}
