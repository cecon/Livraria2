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
import { PaymentRow } from "./PaymentRow";
import { brl } from "@/lib/format";
import { paraCentavos, type Pagamentos } from "@/lib/venda";
import type { FormaPagamento } from "@/lib/types";
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


interface Props {
  numero: number | null; cliente: string; itens: unknown[]; totalItens: number;
  totalCentavos: number; pagoCentavos: number; restante: number; troco: number;
  formas: FormaPagamento[]; pag: Pagamentos; ocupado: boolean; bloqueado: boolean; caixaAberto: boolean;
  onPagamento: (id: number, valor: number) => void; receberRestante: (id: number) => void;
  receber: () => Promise<void>; limpar: () => void;
  registrarCampo: (id: number, elemento: HTMLInputElement | null) => void;
  focarPagamento: (indice: number) => void;
}
export function ResumoPedido({ numero, cliente, itens, totalItens, totalCentavos, pagoCentavos,
  restante, troco, formas, pag, ocupado, bloqueado, caixaAberto, onPagamento, receberRestante,
  receber, limpar, registrarCampo, focarPagamento }: Props) {
  return (      <aside className="bg-card flex flex-col gap-3 rounded-xl border p-5">
        <div className="text-muted-foreground text-[13px]">
          Resumo do Pedido Nº {numero ?? "—"} · {cliente}
        </div>
        <div className="text-muted-foreground text-xs">
          Títulos: {itens.length} · Itens: {totalItens}
        </div>
        <div className="font-mono text-2xl font-bold">{brl(totalCentavos)}</div>

        <div className="bg-muted/40 space-y-2 rounded-lg p-3">
          <div className="text-muted-foreground text-[11px] uppercase">Formas de Pagamento</div>
          {formas.map((f, indice) => (
            <PaymentRow
              key={f.id}
              rotulo={f.rotulo}
              Icon={ICONES[f.chave] ?? Wallet}
              valor={paraCentavos(pag[f.id])}
              onChange={(t) => onPagamento(f.id, t)}
              onReceberRestante={() => receberRestante(f.id)}
              onReceberVenda={() => void receber()}
              podeReceberVenda={caixaAberto && itens.length > 0 && !ocupado && !bloqueado}
              restanteCentavos={restante}
              inputRef={(elemento) => registrarCampo(f.id, elemento)}
              onNavigate={(direcao) => focarPagamento(indice + direcao)}
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
          onClick={() => void receber()}
          disabled={ocupado || bloqueado || !caixaAberto}
          title={!caixaAberto ? "Abra um turno para vender" : undefined}
          className="mt-1 h-11 bg-[#1f7a4d] text-white hover:bg-[#1a6a43]"
        >
          Receber
        </Button>
        <Button variant="ghost" onClick={limpar} className="text-rose-500 hover:text-rose-600">
          Apagar Pedido
        </Button>
      </aside>);
}

