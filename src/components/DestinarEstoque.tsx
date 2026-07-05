// Destinar estoque (US1, FR-006/FR-007): saldos por destinação do livro,
// transferência entre Livre e carimbos (sem tocar no físico) e histórico.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  destinacaoSaldosLivro,
  destinacaoTransferenciasLivro,
  destinacaoTransferir,
  destinacoesListarAtivas,
  type ErroIpc,
} from "@/lib/ipc";
import type { Destinacao, SaldoLivro, Transferencia } from "@/lib/types";
import {
  LIVRE,
  opcoesDestino,
  opcoesOrigem,
  paraPayload,
  validarTransferenciaUi,
} from "@/lib/destinar";

export function DestinarEstoque({ codigo }: { codigo: string }) {
  const [aberto, setAberto] = useState(false);
  const [saldos, setSaldos] = useState<SaldoLivro | null>(null);
  const [ativas, setAtivas] = useState<Destinacao[]>([]);
  const [historico, setHistorico] = useState<Transferencia[] | null>(null);
  const [de, setDe] = useState(LIVRE);
  const [para, setPara] = useState("");
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    try {
      setSaldos(await destinacaoSaldosLivro(codigo));
      setAtivas(await destinacoesListarAtivas());
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao carregar saldos");
    }
  }, [codigo]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  async function transferir() {
    const invalido = validarTransferenciaUi(qtd, para);
    if (invalido) {
      toast.error(invalido);
      return;
    }
    try {
      const s = await destinacaoTransferir(
        codigo,
        paraPayload(de),
        paraPayload(para),
        parseInt(qtd, 10),
        motivo.trim() || undefined,
      );
      setSaldos(s);
      setQtd("");
      setMotivo("");
      setHistorico(null);
      toast.success("Destino atualizado");
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao transferir");
    }
  }

  async function verHistorico() {
    try {
      setHistorico(await destinacaoTransferenciasLivro(codigo));
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao carregar histórico");
    }
  }

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        Destinar estoque
      </Button>
    );
  }

  const origens = opcoesOrigem(saldos);
  const destinos = opcoesDestino(ativas, de);

  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground mr-1">Saldos:</span>
        <Badge variant="secondary">Livre {saldos?.livre ?? "…"}</Badge>
        {(saldos?.carimbos ?? []).map((c) => (
          <Badge key={c.destinacaoId}>
            {c.nome} {c.qtd}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
        <div>
          <Label className="text-xs">De</Label>
          <select
            value={de}
            onChange={(e) => setDe(e.currentTarget.value)}
            className="border-input bg-background mt-1 h-8 w-full rounded-md border px-2 text-sm"
          >
            {origens.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Para</Label>
          <select
            value={para}
            onChange={(e) => setPara(e.currentTarget.value)}
            className="border-input bg-background mt-1 h-8 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Escolha…</option>
            {destinos.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Qtd</Label>
          <Input
            value={qtd}
            onChange={(e) => setQtd(e.currentTarget.value)}
            className="mt-1 h-8 font-mono"
          />
        </div>
      </div>
      <div className="mt-2">
        <Label className="text-xs">Motivo (opcional)</Label>
        <Input
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
          placeholder="ex.: doação da autora"
          className="mt-1 h-8"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={verHistorico}>
          Histórico
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
            Fechar
          </Button>
          <Button size="sm" onClick={transferir}>
            Transferir
          </Button>
        </div>
      </div>
      {historico && (
        <div className="mt-3 border-t pt-2 text-xs">
          {historico.length === 0 && (
            <div className="text-muted-foreground">Nenhuma transferência ainda.</div>
          )}
          {historico.map((t) => (
            <div key={t.id} className="flex justify-between gap-2 py-0.5">
              <span>
                {t.de ?? "Livre"} → {t.para ?? "Livre"}{" "}
                <span className="font-mono">({t.qtd})</span>
                {t.motivo && <span className="text-muted-foreground"> — {t.motivo}</span>}
              </span>
              <span className="text-muted-foreground shrink-0">
                {t.criadoEm.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
