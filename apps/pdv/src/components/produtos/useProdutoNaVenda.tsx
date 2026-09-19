import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { livroPorCodigo } from "@/lib/ipc";
import { consultarProduto, erroProduto } from "@/lib/produtos";
import type { Livro } from "@/lib/types";
import { ConfirmarCadastro } from "./ConfirmarCadastro";
import { ProdutoModal } from "./ProdutoModal";

export function useProdutoNaVenda(inserir: (livro: Livro, qtd: number) => void, concluir: () => void) {
  const [buscando, setBuscando] = useState(false);
  const [pendente, setPendente] = useState<{ codigo: string; qtd: number; cadastrar: boolean } | null>(null);
  const trava = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  function fechar() { setPendente(null); trava.current = false; concluir(); }
  async function adicionar(codigo: string, qtd: number) {
    const cod = codigo.trim();
    if (!cod || trava.current) return;
    trava.current = true; setBuscando(true);
    let aguardar = false;
    try {
      const local = await livroPorCodigo(cod);
      if (!montado.current) return;
      if (local) { inserir(local, qtd); concluir(); return; }
      const remoto = await consultarProduto(cod);
      if (!montado.current) return;
      if (!remoto) { aguardar = true; setPendente({ codigo: cod, qtd, cadastrar: false }); }
      else if (remoto.livro && !remoto.pendenteLocal) { inserir(remoto.livro, qtd); concluir(); }
      else toast.error(remoto.pendenteLocal ? "Produto encontrado, mas ainda não disponível neste PDV. Tente sincronizar." : "Produto inativo ou excluído na retaguarda.");
    } catch (e) { if (montado.current) toast.error(erroProduto(e)); }
    finally { if (montado.current) { setBuscando(false); if (!aguardar) trava.current = false; } }
  }
  const dialog = !pendente ? null : pendente.cadastrar ? <ProdutoModal codigo={pendente.codigo} venda
    onFechar={fechar} onSalvo={(r) => {
      if (r.livro && !r.pendenteLocal) inserir(r.livro, pendente.qtd);
      else toast.info("Produto salvo. Ative-o com estoque positivo para vender.");
      fechar();
    }} /> : <ConfirmarCadastro codigo={pendente.codigo} onCancelar={fechar}
      onConfirmar={() => setPendente({ ...pendente, cadastrar: true })} />;
  return { adicionar, bloqueado: buscando || !!pendente, dialog };
}
