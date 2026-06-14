// Tela Venda / PDV (US1) — fluxo orientado a leitor de código de barras.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Banknote, Church, CreditCard, Gift, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentRow } from "@/components/PaymentRow";
import { BuscaLivro } from "@/components/BuscaLivro";
import { CarrinhoItens, type ItemCarrinho } from "@/components/CarrinhoItens";
import { brl, centavosParaInput, parseBrlParaCentavos } from "@/lib/format";
import type { Livro } from "@/lib/types";
import {
  livroPorCodigo,
  proximoNumeroPedido,
  registrarVenda,
  type ErroIpc,
} from "@/lib/ipc";

type FormaKey = "cartao" | "dinheiro" | "pix" | "ministerio" | "vale";

const FORMAS: { key: FormaKey; rotulo: string; Icon: typeof CreditCard }[] = [
  { key: "cartao", rotulo: "Cartão", Icon: CreditCard },
  { key: "dinheiro", rotulo: "Dinheiro", Icon: Banknote },
  { key: "pix", rotulo: "PIX", Icon: QrCode },
  { key: "ministerio", rotulo: "Ministério", Icon: Church },
  { key: "vale", rotulo: "Vale Presente", Icon: Gift },
];

const PAG_VAZIO: Record<FormaKey, string> = {
  cartao: "",
  dinheiro: "",
  pix: "",
  ministerio: "",
  vale: "",
};

export default function Venda() {
  const [numero, setNumero] = useState<number | null>(null);
  const [cliente, setCliente] = useState("CLIENTE");
  const [qtd, setQtd] = useState("1");
  const [codigo, setCodigo] = useState("");
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pag, setPag] = useState<Record<FormaKey, string>>(PAG_VAZIO);
  const [ocupado, setOcupado] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    proximoNumeroPedido().then(setNumero).catch(() => setNumero(null));
    codigoRef.current?.focus();
  }, []);

  const totalCentavos = useMemo(
    () => itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0),
    [itens],
  );
  const pagoCentavos = useMemo(
    () =>
      FORMAS.reduce((s, f) => s + (parseBrlParaCentavos(pag[f.key]) ?? 0), 0),
    [pag],
  );
  const restante = Math.max(0, totalCentavos - pagoCentavos);
  const troco = Math.max(0, pagoCentavos - totalCentavos);
  const totalItens = itens.reduce((s, i) => s + i.qtd, 0);

  function focarCodigo() {
    setTimeout(() => codigoRef.current?.focus(), 0);
  }

  function qtdAtual() {
    return Math.max(1, parseInt(qtd, 10) || 1);
  }

  function inserirNoCarrinho(livro: Livro, q: number) {
    setItens((atual) => {
      const i = atual.findIndex((x) => x.codigo === livro.codigo);
      if (i >= 0) {
        const copia = [...atual];
        copia[i] = { ...copia[i], qtd: copia[i].qtd + q };
        return copia;
      }
      return [
        ...atual,
        {
          codigo: livro.codigo,
          titulo: livro.titulo,
          precoCentavos: livro.precoCentavos,
          qtd: q,
        },
      ];
    });
    setQtd("1");
  }

  async function adicionar() {
    const cod = codigo.trim();
    if (!cod) return;
    try {
      const livro = await livroPorCodigo(cod);
      if (!livro) {
        toast.error(`Código ${cod} não encontrado`);
        return;
      }
      inserirNoCarrinho(livro, qtdAtual());
      setCodigo("");
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao buscar o livro");
    } finally {
      focarCodigo();
    }
  }

  function alterarQtd(cod: string, delta: number) {
    setItens((atual) =>
      atual.map((i) =>
        i.codigo === cod ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i,
      ),
    );
  }

  function remover(cod: string) {
    setItens((atual) => atual.filter((i) => i.codigo !== cod));
  }

  function receberRestante(key: FormaKey) {
    const atualCentavos = parseBrlParaCentavos(pag[key]) ?? 0;
    setPag((p) => ({ ...p, [key]: centavosParaInput(atualCentavos + restante) }));
  }

  function apagar() {
    setItens([]);
    setPag(PAG_VAZIO);
    focarCodigo();
  }

  async function receber() {
    if (itens.length === 0) {
      toast.error("Adicione itens ao pedido");
      return;
    }
    if (restante > 0) {
      toast.error(`Falta ${brl(restante)}`);
      return;
    }
    setOcupado(true);
    try {
      const r = await registrarVenda({
        cliente,
        itens: itens.map((i) => ({ codigo: i.codigo, qtd: i.qtd })),
        pagamentos: {
          cartao: parseBrlParaCentavos(pag.cartao) ?? 0,
          dinheiro: parseBrlParaCentavos(pag.dinheiro) ?? 0,
          pix: parseBrlParaCentavos(pag.pix) ?? 0,
          ministerio: parseBrlParaCentavos(pag.ministerio) ?? 0,
          vale: parseBrlParaCentavos(pag.vale) ?? 0,
        },
      });
      toast.success(
        `Pedido Nº ${r.numero} recebido` +
          (r.trocoCentavos > 0 ? ` · Troco ${brl(r.trocoCentavos)}` : ""),
      );
      setItens([]);
      setPag(PAG_VAZIO);
      setCliente("CLIENTE");
      const prox = await proximoNumeroPedido();
      setNumero(prox);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao receber o pedido");
    } finally {
      setOcupado(false);
      focarCodigo();
    }
  }

  return (
    <div className="grid h-screen grid-cols-[1fr_356px] gap-5 p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Venda</h1>
          <span className="bg-muted rounded-md px-2 py-1 font-mono text-xs">
            Pedido Nº {numero ?? "—"}
          </span>
          <Input
            value={cliente}
            onChange={(e) => setCliente(e.currentTarget.value)}
            className="ml-auto h-9 w-56"
            placeholder="Cliente"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="w-20">
            <label className="text-muted-foreground text-[11px] uppercase">Qtd.</label>
            <Input
              value={qtd}
              onChange={(e) => setQtd(e.currentTarget.value)}
              inputMode="numeric"
              className="h-9 text-center font-mono"
            />
          </div>
          <div className="flex-1">
            <label className="text-muted-foreground text-[11px] uppercase">
              Código de Barras
            </label>
            <Input
              ref={codigoRef}
              value={codigo}
              autoFocus
              onChange={(e) => setCodigo(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              className="h-9 font-mono"
              placeholder="Escaneie ou digite o código"
            />
          </div>
          <Button onClick={adicionar} className="h-9">
            Adicionar
          </Button>
        </div>

        <BuscaLivro
          numero={numero}
          onSelect={(l) => {
            inserirNoCarrinho(l, qtdAtual());
            focarCodigo();
          }}
        />

        <CarrinhoItens itens={itens} onAlterar={alterarQtd} onRemover={remover} />
      </div>

      <aside className="bg-card flex flex-col gap-3 rounded-xl border p-5">
        <div className="text-muted-foreground text-[13px]">
          Resumo do Pedido Nº {numero ?? "—"} · {cliente}
        </div>
        <div className="text-muted-foreground text-xs">
          Títulos: {itens.length} · Itens: {totalItens}
        </div>
        <div className="font-mono text-2xl font-bold">{brl(totalCentavos)}</div>

        <div className="bg-muted/40 space-y-2 rounded-lg p-3">
          <div className="text-muted-foreground text-[11px] uppercase">Formas de Pagamento</div>
          {FORMAS.map((f) => (
            <PaymentRow
              key={f.key}
              rotulo={f.rotulo}
              Icon={f.Icon}
              valor={pag[f.key]}
              onChange={(t) => setPag((p) => ({ ...p, [f.key]: t }))}
              onReceberRestante={() => receberRestante(f.key)}
              restanteCentavos={restante}
            />
          ))}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Pago</span>
          <span className="font-mono">{brl(pagoCentavos)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium">
          <span>{troco > 0 ? "Troco" : "Restante"}</span>
          <span className={`font-mono ${troco > 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {brl(troco > 0 ? troco : restante)}
          </span>
        </div>

        <Button
          onClick={receber}
          disabled={ocupado}
          className="mt-1 h-11 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]"
        >
          Receber
        </Button>
        <Button variant="ghost" onClick={apagar} className="text-rose-500 hover:text-rose-600">
          Apagar Pedido
        </Button>
      </aside>
    </div>
  );
}
