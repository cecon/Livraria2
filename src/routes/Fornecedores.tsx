// Tela de Fornecedores (US1): lista com busca, ações editar/remover e paginação.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { FornecedorForm } from "@/components/FornecedorForm";
import {
  fornecedorExcluir,
  fornecedoresListar,
  type ErroIpc,
} from "@/lib/ipc";
import type { Fornecedor } from "@/lib/types";

const POR_PAGINA = 12;

export default function Fornecedores() {
  const [aberto, setAberto] = useState<Fornecedor | "novo" | null>(null);
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [pagina, setPagina] = useState(1);

  async function carregar() {
    try {
      setLista(await fornecedoresListar(termo.trim()));
      setPagina(1);
    } catch {
      setLista([]);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(carregar, 160);
    return () => window.clearTimeout(id);
  }, [termo]);

  async function remover(f: Fornecedor) {
    if (!window.confirm(`Inativar "${f.nome}"?`)) return;
    try {
      await fornecedorExcluir(f.id);
      toast.success("Fornecedor inativado");
      void carregar();
    } catch (e) {
      toast.error((e as ErroIpc).mensagem ?? "Erro ao inativar");
    }
  }

  if (aberto !== null) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {aberto === "novo" ? "Novo fornecedor" : "Alterar fornecedor"}
        </h1>
        <FornecedorForm
          inicial={aberto === "novo" ? null : aberto}
          onSalvo={() => {
            setAberto(null);
            void carregar();
          }}
          onCancelar={() => setAberto(null)}
        />
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const inicio = (pagina - 1) * POR_PAGINA;
  const visiveis = lista.slice(inicio, inicio + POR_PAGINA);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
        <Button onClick={() => setAberto("novo")} className="h-9">
          <Plus size={16} className="mr-1" /> Novo fornecedor
        </Button>
      </div>

      <Input
        value={termo}
        onChange={(e) => setTermo(e.currentTarget.value)}
        className="mt-4 h-9"
        placeholder="Buscar por nome…"
        autoFocus
      />

      <div className="bg-card mt-4 rounded-xl border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[55%]">Fornecedor</TableHead>
              <TableHead className="w-[28%]">Telefone</TableHead>
              <TableHead className="w-[17%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <div className="truncate font-medium">{f.nome}</div>
                  {f.documento && (
                    <div className="text-muted-foreground truncate text-[11px] font-mono">
                      {f.documento}
                    </div>
                  )}
                </TableCell>
                <TableCell className="truncate">{f.telefone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setAberto(f)} title="Editar">
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remover(f)}
                      title="Inativar"
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visiveis.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-muted-foreground py-10 text-center">
                  {termo.trim() ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {lista.length > POR_PAGINA && (
        <div className="text-muted-foreground mt-3 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ‹
          </Button>
          <span className="tabular-nums">{pagina} / {totalPaginas}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
