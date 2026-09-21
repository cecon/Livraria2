// PDV (US1) — fluxo por leitor de código. O rascunho da venda é salvo no
// localStorage para não se perder se o app reiniciar/atualizar no meio.
// Formas de pagamento vêm do cadastro (listar_formas_ativas), na ordem (FR-012);
// o troco é amarrado à forma de chave 'dinheiro' (FR-013).

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@livraria/ui/wowdash/card";
import { ResumoPedido } from "./ResumoPedido";
import { EntradaProduto } from "@/components/EntradaProduto";
import { CarrinhoItens, type ItemCarrinho } from "@/components/CarrinhoItens";
import { VendaConcluida, type VendaConcluidaInfo } from "@/components/VendaConcluida";
import { brl } from "@/lib/format";
import { operadorAtual } from "@/lib/operador";
import { vendaEmAndamento, guardarVenda } from "@/lib/venda-em-andamento";
import { useProdutoNaVenda } from "./produtos/useProdutoNaVenda";
import { usePaymentNavigation } from "@/lib/usePaymentNavigation";
import {
  pagamentosParaPayload,
  paraCentavos,
  quantidadeDoAtalho,
  somaPagamentos,
  type Pagamentos,
} from "@/lib/venda";
import type { FormaPagamento, Livro } from "@/lib/types";
import {
  listarFormasAtivas,
  proximoNumeroPedido,
  registrarVenda,
  turnoAberto,
  type ErroIpc,
  type TurnoAberto,
} from "@/lib/ipc";

export function Pdv() {
  const inicial = vendaEmAndamento();
  const [numero, setNumero] = useState<number | null>(null);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [cliente, setCliente] = useState(inicial?.cliente ?? "CLIENTE");
  const [qtd, setQtd] = useState("1");
  const [codigo, setCodigo] = useState("");
  const [itens, setItens] = useState<ItemCarrinho[]>(inicial?.itens ?? []);
  const [pag, setPag] = useState<Pagamentos>(inicial?.pag ?? {});
  const [ocupado, setOcupado] = useState(false);
  const [concluida, setConcluida] = useState<VendaConcluidaInfo | null>(null);
  const [turno, setTurno] = useState<TurnoAberto | null>(null);
  const [turnoCarregado, setTurnoCarregado] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);
  const recebendoRef = useRef(false);
  const { registrarCampo, focarPagamento } = usePaymentNavigation(formas, codigoRef);

  useEffect(() => {
    proximoNumeroPedido().then(setNumero).catch(() => setNumero(null));
    listarFormasAtivas()
      .then(setFormas)
      .catch(() => toast.error("Erro ao carregar as formas de pagamento"));
    // Turno obrigatório para vender (FR-002): checa se há um aberto do operador.
    turnoAberto(operadorAtual())
      .then(setTurno)
      .catch(() => setTurno(null))
      .finally(() => setTurnoCarregado(true));
    codigoRef.current?.focus();
  }, []);

  // Salva o rascunho a cada mudança (sobrevive a reinício/atualização).
  useEffect(() => {
    guardarVenda({ cliente, itens, pag });
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
    const foco = () => codigoRef.current?.focus();
    setTimeout(foco, 0);
    setTimeout(foco, 80);
  }

  function alterarCodigo(valor: string) {
    const quantidade = quantidadeDoAtalho(valor);
    if (quantidade === undefined) {
      setCodigo(valor);
      return;
    }
    setCodigo("");
    if (quantidade === null) {
      toast.error("Informe uma quantidade positiva válida antes de *.");
      return;
    }
    setQtd(String(quantidade));
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

  const produtoNaVenda = useProdutoNaVenda(inserirNoCarrinho, () => { setCodigo(""); focarCodigo(); });
  function adicionar() { return produtoNaVenda.adicionar(codigo, qtdAtual()); }

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
    if (recebendoRef.current || produtoNaVenda.bloqueado) return;
    if (!turno) {
      toast.error("Abra um turno antes de vender.");
      return;
    }
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
    recebendoRef.current = true;
    setOcupado(true);
    try {
      const r = await registrarVenda({
        cliente,
        itens: itens.map((i) => ({ codigo: i.codigo, qtd: paraCentavos(i.qtd) })),
        pagamentos: pagamentosParaPayload(pag),
        operador: operadorAtual() || undefined,
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
      recebendoRef.current = false;
      setOcupado(false);
      focarCodigo();
    }
  }

  return (
    <div className="grid min-h-full grid-cols-1 gap-5 p-5 lg:h-full lg:grid-cols-[minmax(0,1fr)_356px]">
      <div className="flex min-w-0 flex-col gap-4">
        {turnoCarregado && !turno && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span className="flex-1">Nenhum turno aberto. Abra um turno para registrar vendas.</span>
            <Link to="/" className="rounded-md bg-[#1f7a4d] px-3 py-1.5 text-white hover:bg-[#1a6a43]">
              Ir ao início
            </Link>
          </div>
        )}
        <Card className="gap-0 rounded-lg py-0">
          <CardHeader className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
            <span className="bg-muted rounded-md px-2 py-1 font-mono text-xs">
              Pedido Nº {numero ?? "—"}
            </span>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.currentTarget.value)}
              className="ml-auto h-9 w-full sm:w-56"
              placeholder="Cliente"
              aria-label="Cliente"
            />
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2 p-4 sm:p-5">
            <div className="w-20">
              <label className="text-muted-foreground text-[11px] uppercase">Qtd.</label>
              <Input
                value={qtd}
                onChange={(e) => setQtd(e.currentTarget.value)}
                inputMode="numeric"
                className="h-9 text-center font-mono"
              />
            </div>
            <div className="min-w-40 flex-1">
              <label className="text-muted-foreground text-[11px] uppercase">
                Código, título ou autor
              </label>
              <EntradaProduto
                disabled={produtoNaVenda.bloqueado || ocupado}
                value={codigo}
                onChange={alterarCodigo}
                inputRef={codigoRef}
                onCodigoExato={adicionar}
                onPagamento={(direcao) => focarPagamento(direcao === 1 ? 0 : formas.length - 1)}
                onSelecionar={(l) => {
                  inserirNoCarrinho(l, qtdAtual());
                  setCodigo("");
                  focarCodigo();
                }}
              />
            </div>
            <Button disabled={produtoNaVenda.bloqueado || ocupado} onClick={adicionar} className="h-9">
              Adicionar
            </Button>
          </CardContent>
        </Card>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <CarrinhoItens itens={itens} onAlterar={alterarQtd} onRemover={remover} />
          {concluida && (
            <VendaConcluida info={concluida} onDispensar={() => setConcluida(null)} />
          )}
        </div>
      </div>

      <ResumoPedido numero={numero} cliente={cliente} itens={itens} totalItens={totalItens}
        totalCentavos={totalCentavos} pagoCentavos={pagoCentavos} restante={restante} troco={troco}
        formas={formas} pag={pag} ocupado={ocupado} bloqueado={produtoNaVenda.bloqueado} caixaAberto={!!turno}
        onPagamento={(id, valor) => setPag((p) => ({ ...p, [id]: valor }))}
        receberRestante={receberRestante} receber={receber} limpar={limpar}
        registrarCampo={registrarCampo} focarPagamento={focarPagamento} />
      {produtoNaVenda.dialog}
    </div>
  );
}
