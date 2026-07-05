// Tela Cadastro (US2): lista de livros com busca, estoque, ações e paginação.

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, HeartHandshake, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockBadge } from "@/components/StockBadge";
import { LivroForm } from "@/components/LivroForm";
import { DestinarEstoque } from "@/components/DestinarEstoque";
import { brl } from "@/lib/format";
import type { Livro } from "@/lib/types";
import { excluirLivro, livrosPagina, resolverPendencia, type ErroIpc } from "@/lib/ipc";

const POR_PAGINA = 12;

export default function Cadastro() {
  const [aberto, setAberto] = useState<Livro | "novo" | null>(null);
  const [termo, setTermo] = useState("");
  const [itens, setItens] = useState<Livro[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  // Livro com o painel "Destinar estoque" aberto (linha expandida — US1 da 006).
  const [destinando, setDestinando] = useState<string | null>(null);

  // US4: vindo de uma pendência, abre "novo livro" semeando o código lido e
  // resolve a pendência ao salvar com sucesso.
  const location = useLocation();
  const [codigoSeed, setCodigoSeed] = useState<string | undefined>();
  const pendenciaRef = useRef<number | null>(null);

  useEffect(() => {
    const st = location.state as { novoCodigo?: string; pendenciaId?: number } | null;
    if (st?.novoCodigo) {
      setCodigoSeed(st.novoCodigo);
      pendenciaRef.current = st.pendenciaId ?? null;
      setAberto("novo");
      // limpa o state da navegação para não reabrir ao voltar.
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  async function carregar(t: string, p: number) {
    try {
      const r = await livrosPagina(t.trim(), p, POR_PAGINA);
      setItens(r.itens);
      setTotal(r.total);
    } catch {
      setItens([]);
      setTotal(0);
    }
  }

  // Busca paginada no banco (debounce). Trocar o termo volta à página 1.
  useEffect(() => {
    const id = window.setTimeout(() => void carregar(termo, pagina), 160);
    return () => window.clearTimeout(id);
  }, [termo, pagina]);

  async function remover(l: Livro) {
    if (!window.confirm(`Excluir "${l.titulo}"?`)) return;
    try {
      await excluirLivro(l.codigo);
      toast.success("Livro excluído");
      void carregar(termo, pagina);
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao excluir");
    }
  }

  if (aberto !== null) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {aberto === "novo" ? "Novo livro" : "Alterar livro"}
        </h1>
        <LivroForm
          inicial={aberto === "novo" ? null : aberto}
          codigoInicial={aberto === "novo" ? codigoSeed : undefined}
          onSalvo={async () => {
            // US4: se veio de uma pendência, marca-a resolvida ao salvar.
            const pid = pendenciaRef.current;
            if (pid != null) {
              try {
                await resolverPendencia(pid);
              } catch {
                /* a pendência permanece se falhar */
              }
            }
            pendenciaRef.current = null;
            setCodigoSeed(undefined);
            setAberto(null);
            void carregar(termo, pagina);
          }}
          onCancelar={() => {
            pendenciaRef.current = null;
            setCodigoSeed(undefined);
            setAberto(null);
          }}
        />
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const inicio = (pagina - 1) * POR_PAGINA;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cadastro</h1>
        <Button
          onClick={() => {
            setCodigoSeed(undefined);
            pendenciaRef.current = null;
            setAberto("novo");
          }}
          className="h-9"
        >
          <Plus size={16} className="mr-1" /> Novo livro
        </Button>
      </div>

      <Input
        value={termo}
        onChange={(e) => {
          setTermo(e.currentTarget.value);
          setPagina(1);
        }}
        className="mt-4 h-9"
        placeholder="Buscar por título, autor ou código…"
        autoFocus
      />

      <div className="bg-card mt-4 rounded-xl border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[48%]">Livro</TableHead>
              <TableHead className="w-[18%] text-right">Preço</TableHead>
              <TableHead className="w-[18%] text-center">Estoque</TableHead>
              <TableHead className="w-[16%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l) => (
              <React.Fragment key={l.codigo}>
              <TableRow>
                <TableCell>
                  <div className="truncate font-medium">{l.titulo}</div>
                  <div className="text-muted-foreground truncate text-[11px]">
                    {l.autor ? `${l.autor} · ` : ""}
                    <span className="font-mono">{l.codigo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">
                  {brl(l.precoCentavos)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono">{l.estoque}</span>
                    <StockBadge estoque={l.estoque} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDestinando((c) => (c === l.codigo ? null : l.codigo))
                      }
                      title="Destinar estoque (Missões, Loja…)"
                      className={
                        destinando === l.codigo
                          ? "text-[#1f7a4d] bg-[#1f7a4d]/10"
                          : "text-[#1f7a4d] hover:text-[#1a6a43]"
                      }
                    >
                      <HeartHandshake size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAberto(l)}
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remover(l)}
                      title="Remover"
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {destinando === l.codigo && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-2">
                    <DestinarEstoque
                      codigo={l.codigo}
                      onFechar={() => setDestinando(null)}
                    />
                  </TableCell>
                </TableRow>
              )}
              </React.Fragment>
            ))}
            {itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  {termo.trim() ? "Nenhum livro encontrado." : "Nenhum livro cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
          <span>
            {inicio + 1}–{Math.min(inicio + POR_PAGINA, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="tabular-nums">
              {pagina} / {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
