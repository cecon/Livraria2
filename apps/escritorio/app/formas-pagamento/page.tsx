"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import {
  listarFormas,
  salvarForma,
  definirFormaAtiva,
  excluirForma,
  reordenarFormas,
  type Forma,
} from "@/lib/nuvem/forma";

// Formas de pagamento (US2) — paridade com o PDV: descrição, form inline de
// nome, lista com reordenar (↑/↓), ativar/desativar, excluir e selo "sistema".
export default function FormasPagamentoPage() {
  const [formas, setFormas] = useState<Forma[]>([]);
  const [editando, setEditando] = useState<Forma | null>(null);
  const [criando, setCriando] = useState(false);

  async function carregar() {
    setFormas(await listarFormas());
  }
  useEffect(() => {
    carregar();
  }, []);

  function fecharForm() {
    setCriando(false);
    setEditando(null);
  }

  async function mover(i: number, delta: number) {
    const destino = i + delta;
    if (destino < 0 || destino >= formas.length) return;
    const nova = [...formas];
    [nova[i], nova[destino]] = [nova[destino], nova[i]];
    setFormas(nova);
    const { error } = await reordenarFormas(nova);
    if (error) toast.error(error);
    carregar();
  }

  async function alternarAtiva(f: Forma) {
    const { error } = await definirFormaAtiva(f.sync_uid, !f.ativa);
    if (error) return toast.error(error);
    toast.success(`"${f.rotulo}" ${f.ativa ? "desativada" : "ativada"}`);
    carregar();
  }

  async function excluir(f: Forma) {
    if (!window.confirm(`Excluir a forma "${f.rotulo}"?`)) return;
    const { error } = await excluirForma(f.sync_uid);
    if (error) return toast.error(error);
    toast.success(`"${f.rotulo}" excluída`);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Formas de pagamento</h1>
          <p className="text-muted-foreground text-sm">
            A ordem daqui vale para o PDV e os relatórios. Formas com o selo “sistema” podem ser renomeadas, mas não excluídas nem desativadas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setCriando(true);
          }}
          className="h-9"
        >
          <Plus size={15} /> Nova forma
        </Button>
      </div>

      {(criando || editando) && (
        <FormaForm
          forma={editando}
          proximaOrdem={formas.length}
          onSalvo={() => {
            fecharForm();
            carregar();
          }}
          onCancelar={fecharForm}
        />
      )}

      {formas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma forma cadastrada.</p>
      ) : (
        <div className="space-y-1">
          {formas.map((f, i) => (
            <div key={f.sync_uid} className={`bg-card flex items-center gap-2 rounded-lg border p-2 text-sm ${f.ativa ? "" : "opacity-60"}`}>
              <div className="flex flex-col">
                <Button variant="ghost" size="icon" className="h-5 w-6" disabled={i === 0} title="Mover para cima" onClick={() => mover(i, -1)}>
                  <ArrowUp size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-6" disabled={i === formas.length - 1} title="Mover para baixo" onClick={() => mover(i, 1)}>
                  <ArrowDown size={13} />
                </Button>
              </div>
              <span className="flex-1 font-medium">{f.rotulo}</span>
              {f.de_sistema && (
                <span className="text-muted-foreground bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase" title="Forma de sistema: pode ser renomeada e reordenada.">
                  <Lock size={10} /> sistema
                </span>
              )}
              {!f.ativa && <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">inativa</span>}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Renomear" onClick={() => { setCriando(false); setEditando(f); }}>
                <Pencil size={14} />
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[12px]" disabled={f.de_sistema} title={f.de_sistema ? "Formas de sistema não podem ser desativadas" : f.ativa ? "Some das opções do PDV; o histórico continua" : "Volta a aparecer no PDV"} onClick={() => alternarAtiva(f)}>
                {f.ativa ? "Desativar" : "Ativar"}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" disabled={f.de_sistema} title={f.de_sistema ? "Formas de sistema não podem ser excluídas" : "Excluir"} onClick={() => excluir(f)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormaForm({ forma, proximaOrdem, onSalvo, onCancelar }: { forma: Forma | null; proximaOrdem: number; onSalvo: () => void; onCancelar: () => void }) {
  const [rotulo, setRotulo] = useState(forma?.rotulo ?? "");
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    if (!rotulo.trim()) return toast.error("Informe o nome da forma de pagamento");
    setOcupado(true);
    const { error } = forma
      ? await salvarForma({ sync_uid: forma.sync_uid, chave: forma.chave, de_sistema: forma.de_sistema, rotulo, ativa: forma.ativa, ordem: forma.ordem })
      : await salvarForma({ rotulo, ativa: true, ordem: proximaOrdem });
    setOcupado(false);
    if (error) return toast.error(error);
    toast.success(forma ? `Forma renomeada para "${rotulo.trim()}"` : `Forma "${rotulo.trim()}" criada`);
    onSalvo();
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="text-sm font-medium">{forma ? `Renomear "${forma.rotulo}"` : "Nova forma de pagamento"}</div>
      <div>
        <Label htmlFor="rotulo-forma">Nome</Label>
        <Input id="rotulo-forma" value={rotulo} onChange={(e) => setRotulo(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} placeholder="Ex.: Boleto" className="mt-1 h-9" autoFocus />
        {forma?.de_sistema && <p className="text-muted-foreground mt-1 text-[11px]">Forma de sistema: pode ser renomeada, mas não excluída nem desativada.</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={ocupado} className="h-9">{forma ? "Renomear" : "Criar"}</Button>
        <Button variant="ghost" onClick={onCancelar} className="h-9">Cancelar</Button>
      </div>
    </div>
  );
}
