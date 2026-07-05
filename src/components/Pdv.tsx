// PDV (US1) — fluxo por leitor de código. O rascunho da venda é salvo no
// localStorage para não se perder se o app reiniciar/atualizar no meio.
// Formas de pagamento vêm do cadastro (listar_formas_ativas), na ordem (FR-012);
// o troco é amarrado à forma de chave 'dinheiro' (FR-013).

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Church,
  CreditCard,
  Gift,
  QrCode,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentRow } from "@/components/PaymentRow";
import { EntradaProduto } from "@/components/EntradaProduto";
import { CarrinhoItens, type ItemCarrinho } from "@/components/CarrinhoItens";
import { VendaConcluida, type VendaConcluidaInfo } from "@/components/VendaConcluida";
import { brl } from "@/lib/format";
import {
  RASCUNHO_KEY,
  pagamentosParaPayload,
  paraCentavos,
  parseRascunho,
  somaPagamentos,
  type Pagamentos,
} from "@/lib/venda";
import type { FormaPagamento, Livro } from "@/lib/types";
import {
  listarFormasAtivas,
  livroPorCodigo,
  proximoNumeroPedido,
  registrarVenda,
  type ErroIpc,
} from "@/lib/ipc";

/** Ícone por chave estável; formas criadas pelo usuário caem no genérico. */
const ICONES: Record<string, LucideIcon> = {
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
  pix: QrCode,
  pix_igreja: Church,
  ministerio: Church,
  vale: Gift,
};

export function Pdv() {
  const inicial = parseRascunho(localStorage.getItem(RASCUNHO_KEY));
  const [numero, setNumero] = useState<number | null>(null);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cliente, setCliente] = useState(inicial?.cliente ?? "CLIENTE");
  const [qtd, setQtd] = useState("1");
  const [codigo, setCodigo] = useState("");
  const [itens, setItens] = useState<ItemCarrinho[]>(inicial?.itens ?? []);
  const [pag, setPag] = useState<Pagamentos>(inicial?.pag ?? {});
  const [ocupado, setOcupado] = useState(false);
  const [concluida, setConcluida] = useState<VendaConcluidaInfo | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    proximoNumeroPedido().then(setNumero).catch(() => setNumero(null));
    listarFormasAtivas()
      .then(setFormas)
      .catch(() => toast.error("Erro ao carregar as formas de pagamento"));
    codigoRef.current?.focus();
  }, []);

  // Salva o rascunho a cada mudança (sobrevive a reinício/atualização).
  useEffect(() => {
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ cliente, itens, pag }));
  }, [cliente, itens, pag]);

  const dinheiro = useMemo(
    () => formas.find((f) => f.chave === "dinheiro"),
    [formas],
  );
  const totalCentavos = useMemo(
    () => itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0),
    [itens],
  );
  const pagoCentavos = useMemo(() => somaPagamentos(pag), [pag]);
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
    setConcluida(null); // qualquer item novo dispensa a confirmação (FR-015)
    setItens((atual) => {
      const i = atual.findIndex((x) => x.codigo === livro.codigo);
      if (i >= 0) {
        const copia = [...atual];
        copia[i] = { ...copia[i], qtd: copia[i].qtd + q };
        return copia;
      }
      return [
        ...atual,
        { codigo: livro.codigo, titulo: livro.titulo, precoCentavos: livro.precoCentavos, qtd: q },
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
      atual.map((i) => (i.codigo === cod ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)),
    );
  }

  function remover(cod: string) {
    setItens((atual) => atual.filter((i) => i.codigo !== cod));
  }

  function receberRestante(formaId: number) {
    setPag((p) => ({ ...p, [formaId]: paraCentavos(p[formaId]) + restante }));
  }

  function limpar() {
    setItens([]);
    setPag({});
    setCliente("CLIENTE");
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
    if (troco > 0 && paraCentavos(dinheiro ? pag[dinheiro.id] : 0) < troco) {
      toast.error("O troco só pode sair do dinheiro. Ajuste as formas de pagamento.");
      return;
    }
    setOcupado(true);
    try {
      const r = await registrarVenda({
        cliente,
        itens: itens.map((i) => ({ codigo: i.codigo, qtd: paraCentavos(i.qtd) })),
        pagamentos: pagamentosParaPayload(pag),
      });
      // Confirmação animada com total/troco; PDV volta ao caixa livre (FR-015).
      setConcluida({
        numero: r.numero,
        totalCentavos: r.totalCentavos,
        trocoCentavos: r.trocoCentavos,
      });
      limpar();
      setNumero(await proximoNumeroPedido());
    } catch (e) {
      const msg =
        typeof e === "string"
          ? e
          : ((e as ErroIpc)?.mensagem ??
            (e instanceof Error ? e.message : JSON.stringify(e)));
      toast.error(msg || "Erro ao receber o pedido");
    } finally {
      setOcupado(false);
      focarCodigo();
    }
  }

  return (
    <div className="grid h-full grid-cols-[1fr_356px] gap-5 p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
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
              Código, título ou autor
            </label>
            <EntradaProduto
              value={codigo}
              onChange={setCodigo}
              inputRef={codigoRef}
              onCodigoExato={adicionar}
              onSelecionar={(l) => {
                inserirNoCarrinho(l, qtdAtual());
                setCodigo("");
                focarCodigo();
              }}
            />
          </div>
          <Button onClick={adicionar} className="h-9">
            Adicionar
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <CarrinhoItens itens={itens} onAlterar={alterarQtd} onRemover={remover} />
          {concluida && (
            <VendaConcluida info={concluida} onDispensar={() => setConcluida(null)} />
          )}
        </div>
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
          {formas.map((f) => (
            <PaymentRow
              key={f.id}
              rotulo={f.rotulo}
              Icon={ICONES[f.chave] ?? Wallet}
              valor={paraCentavos(pag[f.id])}
              onChange={(t) => setPag((p) => ({ ...p, [f.id]: t }))}
              onReceberRestante={() => receberRestante(f.id)}
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
        <Button variant="ghost" onClick={limpar} className="text-rose-500 hover:text-rose-600">
          Apagar Pedido
        </Button>
      </aside>
    </div>
  );
}
