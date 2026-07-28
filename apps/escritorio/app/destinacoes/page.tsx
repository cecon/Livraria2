"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { Input } from "@livraria/ui/ui/input";
import { Label } from "@livraria/ui/ui/label";
import {
  listarDestinacoes,
  salvarDestinacao,
  definirDestinacaoAtiva,
  excluirDestinacao,
  reordenarDestinacoes,
  type Destinacao,
} from "@/lib/nuvem/destinacao";

// Destinações (US2) — paridade com o PDV: descrição, form inline, lista com
// reordenar (só as livres), ativar/desativar, excluir; "Loja" é sistema (topo).
export default function DestinacoesPage() {
  const [destinacoes, setDestinacoes] = useState<Destinacao[]>([]);
  const [editando, setEditando] = useState<Destinacao | null>(null);
  const [criando, setCriando] = useState(false);

  async function carregar() {
    setDestinacoes(await listarDestinacoes());
  }
  useEffect(() => {
    carregar();
  }, []);

  function fecharForm() {
    setCriando(false);
    setEditando(null);
  }

  const livres = destinacoes.filter((d) => !d.de_sistema);

  async function mover(d: Destinacao, delta: number) {
    const i = livres.findIndex((x) => x.sync_uid === d.sync_uid);
    const destino = i + delta;
    if (i < 0 || destino < 0 || destino >= livres.length) return;
    const nova = [...livres];
    [nova[i], nova[destino]] = [nova[destino], nova[i]];
    const { error } = await reordenarDestinacoes(nova);
    if (error) toast.error(error);
    carregar();
  }

  async function alternarAtiva(d: Destinacao) {
    const { error } = await definirDestinacaoAtiva(d.sync_uid, !d.ativa);
    if (error) return toast.error(error);
    toast.success(`"${d.nome}" ${d.ativa ? "desativada" : "ativada"}`);
    carregar();
  }

  async function excluir(d: Destinacao) {
    if (!window.confirm(`Excluir a destinação "${d.nome}"?`)) return;
    const { error } = await excluirDestinacao(d.sync_uid);
    if (error) return toast.error(error);
    toast.success(`"${d.nome}" excluída`);
    carregar();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Destinações</h1>
          <p className="text-muted-foreground text-sm">
            Para onde vai o valor das vendas de livros doados. A ordem daqui é a ordem de baixa na venda; o saldo livre pertence à “Loja”.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setCriando(true);
          }}
          className="h-9"
        >
          <Plus size={15} /> Nova destinação
        </Button>
      </div>

      {(criando || editando) && (
        <DestinacaoForm
          destinacao={editando}
          proximaOrdem={destinacoes.length}
          onSalvo={() => {
            fecharForm();
            carregar();
          }}
          onCancelar={fecharForm}
        />
      )}

      {destinacoes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <div className="space-y-1">
          {destinacoes.map((d) => {
            const iLivre = livres.findIndex((x) => x.sync_uid === d.sync_uid);
            return (
              <div key={d.sync_uid} className={`bg-card flex items-center gap-2 rounded-lg border p-2 text-sm ${d.ativa ? "" : "opacity-60"}`}>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-5 w-6" disabled={d.de_sistema || iLivre === 0} title="Mover para cima" onClick={() => mover(d, -1)}>
                    <ArrowUp size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-6" disabled={d.de_sistema || iLivre === livres.length - 1} title="Mover para baixo" onClick={() => mover(d, 1)}>
                    <ArrowDown size={13} />
                  </Button>
                </div>
                <span className="flex-1 font-medium">{d.nome}</span>
                {d.de_sistema && (
                  <span className="text-muted-foreground bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase" title="Destinação padrão: o saldo livre pertence a ela e é sempre a primeira na ordem de baixa.">
                    <Lock size={10} /> sistema
                  </span>
                )}
                {!d.ativa && <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] uppercase">inativa</span>}
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Renomear" onClick={() => { setCriando(false); setEditando(d); }}>
                  <Pencil size={14} />
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[12px]" disabled={d.de_sistema} title={d.de_sistema ? "A Loja não pode ser desativada" : d.ativa ? "Some das opções de transferência" : "Volta a aceitar transferências"} onClick={() => alternarAtiva(d)}>
                  {d.ativa ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" disabled={d.de_sistema} title={d.de_sistema ? "A Loja não pode ser excluída" : "Excluir"} onClick={() => excluir(d)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DestinacaoForm({ destinacao, proximaOrdem, onSalvo, onCancelar }: { destinacao: Destinacao | null; proximaOrdem: number; onSalvo: () => void; onCancelar: () => void }) {
  const [nome, setNome] = useState(destinacao?.nome ?? "");
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome da destinação");
    setOcupado(true);
    const { error } = destinacao
      ? await salvarDestinacao({ sync_uid: destinacao.sync_uid, de_sistema: destinacao.de_sistema, nome, ativa: destinacao.ativa, ordem: destinacao.ordem })
      : await salvarDestinacao({ nome, ativa: true, ordem: proximaOrdem });
    setOcupado(false);
    if (error) return toast.error(error);
    toast.success(destinacao ? `Destinação renomeada para "${nome.trim()}"` : `Destinação "${nome.trim()}" criada`);
    onSalvo();
  }

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className="text-sm font-medium">{destinacao ? `Renomear "${destinacao.nome}"` : "Nova destinação"}</div>
      <div>
        <Label htmlFor="nome-destinacao">Nome</Label>
        <Input id="nome-destinacao" value={nome} onChange={(e) => setNome(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} placeholder="Ex.: Missões" className="mt-1 h-9" autoFocus />
        {destinacao?.de_sistema && <p className="text-muted-foreground mt-1 text-[11px]">Destinação de sistema: pode ser renomeada, mas não excluída nem desativada.</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={ocupado} className="h-9">{destinacao ? "Renomear" : "Criar"}</Button>
        <Button variant="ghost" onClick={onCancelar} className="h-9">Cancelar</Button>
      </div>
    </div>
  );
}
