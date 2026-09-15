"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@livraria/ui/ui/button";

type Pdv = { uid: string; nome: string; ativo: boolean; cursorAplicado: string;
  cursorEntregue: string; cursorDisponivel: string; confirmadoEm: string | null };

function estado(pdv: Pdv) {
  if (!pdv.ativo) return { texto: "Inativo", classe: "bg-zinc-200 text-zinc-700" };
  if (BigInt(pdv.cursorAplicado) >= BigInt(pdv.cursorDisponivel)) {
    return { texto: "Atualizado", classe: "bg-emerald-100 text-emerald-800" };
  }
  if (BigInt(pdv.cursorEntregue) > BigInt(pdv.cursorAplicado)) {
    return { texto: "Aguardando aplicação", classe: "bg-amber-100 text-amber-800" };
  }
  return { texto: "Pendente", classe: "bg-red-100 text-red-800" };
}

export default function PdvsPage() {
  const [items, setItems] = useState<Pdv[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const response = await fetch("/api/pdvs", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.erro || "Falha na consulta");
      setItems(body);
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha na consulta"); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  return <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Caixas sincronizados</h1>
        <p className="text-sm text-muted-foreground">Confirmação das alterações de catálogo por PDV.</p></div>
      <Button variant="outline" size="icon" onClick={() => void carregar()} title="Atualizar">
        <RefreshCw size={16} className={carregando ? "animate-spin" : ""} />
      </Button>
    </div>
    {erro && <p className="text-sm text-red-600">{erro}</p>}
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b bg-muted/50 text-left">
        <th className="p-3">Caixa</th><th className="p-3">Situação</th><th className="p-3">Confirmado</th>
        <th className="p-3 text-right">Aplicado / disponível</th></tr></thead>
        <tbody>{items.map(pdv => { const status = estado(pdv); return <tr key={pdv.uid} className="border-b last:border-0">
          <td className="p-3 font-medium">{pdv.nome}</td><td className="p-3"><span className={`rounded px-2 py-1 text-xs ${status.classe}`}>{status.texto}</span></td>
          <td className="p-3 text-muted-foreground">{pdv.confirmadoEm ? new Date(pdv.confirmadoEm).toLocaleString("pt-BR") : "Nunca"}</td>
          <td className="p-3 text-right tabular-nums">{pdv.cursorAplicado} / {pdv.cursorDisponivel}</td></tr>; })}</tbody>
      </table>
    </div>
  </div>;
}
