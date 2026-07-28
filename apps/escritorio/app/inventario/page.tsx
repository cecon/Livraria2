"use client";

// Inventário no Escritório (feature 009, US3). Sessão de contagem client-side
// (rascunho em localStorage — D5), reconciliação parcial/total via WASM (regras do
// PDV, ADR-0010); ao aplicar, grava só os ajustes (movimento `contagem`).
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";
import { ContagemInventario, type ItemContado } from "@/components/ContagemInventario";
import { RevisaoContagem } from "@/components/RevisaoContagem";
import type { LivroBusca } from "@/components/EntradaProduto";
import {
  aplicarContagem,
  livrosParaContagem,
  reconciliar,
  type Divergencia,
  type LivroContagem,
  type ModoInventario,
} from "@/lib/nuvem/inventario";

const DRAFT = "eldl-inventario-contados";

export default function InventarioPage() {
  const [carregando, setCarregando] = useState(true);
  const [livros, setLivros] = useState<LivroContagem[]>([]);
  const [modo, setModo] = useState<ModoInventario>("parcial");
  const [contados, setContados] = useState<Map<string, number>>(new Map());
  const [busca, setBusca] = useState("");
  const [revisao, setRevisao] = useState<Divergencia[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    livrosParaContagem()
      .then(setLivros)
      .catch(() => toast.error("Falha ao carregar. Verifique o login."))
      .finally(() => setCarregando(false));
    try {
      const raw = localStorage.getItem(DRAFT);
      if (raw) setContados(new Map(JSON.parse(raw) as [string, number][]));
    } catch {
      /* rascunho ausente/corrompido: ignora */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify([...contados.entries()]));
    } catch {
      /* quota/indisponível: segue sem persistir */
    }
  }, [contados]);

  const buscaLivros: LivroBusca[] = useMemo(
    () => livros.map((l) => ({ sync_uid: l.livroUid, codigo: l.codigo, titulo: l.titulo, autor: null, preco_centavos: 0, estoque: l.saldo })),
    [livros],
  );

  const itens: ItemContado[] = useMemo(() => {
    const porUid = new Map(livros.map((l) => [l.livroUid, l]));
    return [...contados.entries()].map(([livroUid, contado]) => {
      const l = porUid.get(livroUid);
      return { livroUid, codigo: l?.codigo ?? "?", titulo: l?.titulo ?? "?", contado };
    });
  }, [contados, livros]);

  function bip(l: LivroBusca) {
    setContados((prev) => new Map(prev).set(l.sync_uid, (prev.get(l.sync_uid) ?? 0) + 1));
    setBusca("");
    inputRef.current?.focus();
  }
  function qtd(livroUid: string, delta: number) {
    setContados((prev) => {
      const m = new Map(prev);
      m.set(livroUid, Math.max(0, (m.get(livroUid) ?? 0) + delta));
      return m;
    });
  }
  function remover(livroUid: string) {
    setContados((prev) => {
      const m = new Map(prev);
      m.delete(livroUid);
      return m;
    });
  }

  async function fechar() {
    if (modo === "parcial" && contados.size === 0) return toast.error("Conte ao menos um item.");
    setOcupado(true);
    try {
      setRevisao(await reconciliar(modo, contados, livros));
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar() {
    if (!revisao) return;
    setOcupado(true);
    const { error, ajustes } = await aplicarContagem(revisao);
    setOcupado(false);
    if (error) return toast.error(error);
    toast.success(`${ajustes} ajuste(s) aplicado(s)`);
    setContados(new Map());
    setRevisao(null);
    localStorage.removeItem(DRAFT);
    livrosParaContagem().then(setLivros);
  }

  if (carregando) return <div className="p-6 text-muted-foreground text-sm">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ClipboardList size={20} /> Inventário
        </h1>
        <p className="text-muted-foreground text-sm">
          Conte por digitação ou câmera. Parcial ajusta só os contados; total zera os não-contados. A
          reconciliação usa as mesmas regras do PDV.
        </p>
      </div>

      {revisao ? (
        <RevisaoContagem divergencias={revisao} ocupado={ocupado} onAplicar={aplicar} onVoltar={() => setRevisao(null)} />
      ) : (
        <>
          <ContagemInventario
            modo={modo}
            onModo={setModo}
            busca={busca}
            onBusca={setBusca}
            livros={buscaLivros}
            onBip={bip}
            inputRef={inputRef}
            itens={itens}
            onQtd={qtd}
            onRemover={remover}
          />
          <div className="flex items-center gap-3">
            <Button onClick={fechar} disabled={ocupado} className="h-9">
              Fechar sessão e revisar
            </Button>
            <span className="text-muted-foreground text-sm">{contados.size} item(ns) contado(s)</span>
          </div>
        </>
      )}
    </div>
  );
}
