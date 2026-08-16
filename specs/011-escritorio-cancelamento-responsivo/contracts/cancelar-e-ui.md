# Contrato — RPC de cancelamento + UI (Escritório)

## Nuvem — RPC `cancelar_venda` (`SECURITY DEFINER`, transacional)

### `cancelar_venda(p_admin text, p_pedido bigint) → jsonb`
Numa **transação atômica**, na ordem (paridade com o PDV):
1. **Valida** `p_admin` é admin ativo (senão erro `sem permissao`).
2. **Idempotência**: se o pedido já está `cancelado` → retorna ok sem re-estornar/re-devolver.
3. **Janela**: recusa se a venda tem > 5 dias (regra do domínio; erro `janela expirada`).
4. **Devolve carimbos**: para cada `alocacao_venda` do pedido, devolve à destinação de origem
   (`transferencia_destinacao` compensatória, `sync_uid` determinístico — D2/INV-5).
5. **Estorna estoque**: por livro, `net = Σ(saida_venda+estorno)`; se `net < 0`, insere `movimento_estoque`
   `tipo='estorno'`, `qtd=-net`, `referencia=<pedido>`, `sync_uid` **determinístico** (uuidv5).
6. **Marca** `pedido.cancelado=true`, `cancelado_em=now()`, `atualizado_em=now()`, `sincronizado_em=now()`.
7. Retorna `{ ok, pedido, estornos: [{livro, qtd}], carimbos_devolvidos }`.

- `GRANT EXECUTE ... TO authenticated`. Erros retornam mensagem pt-BR curta (a UI mapeia).
- **Sincronização**: tudo escrito nas tabelas já espelhadas → desce ao PDV no pull; `pedido.cancelado`
  por LWW; estorno/carimbo por evento (dedupe por `sync_uid` determinístico).

## Escritório — `lib/nuvem/venda.ts`

```
cancelarVenda(pedidoNumero) → { ok } | { erro }        // chama a RPC (p_admin = app_user do cookie via rota server)
reabrirVenda(pedidoNumero)  → { itens } | { erro }     // cancela + devolve os itens p/ carregar no caixa
```
- A checagem de janela para **habilitar** o botão usa `pode_cancelar_venda` (WASM) — a RPC é a fonte
  final da verdade.

## Escritório — UI

### Lista de vendas (`app/venda/page.tsx`, aba "Lista de vendas")
- Cada venda ganha ações **Cancelar** e **Reabrir**.
- **Cancelar**: confirmação → `cancelarVenda` → recarrega; venda fica riscada/"cancelada" no histórico.
- **Reabrir**: confirmação → `reabrirVenda` → volta pra aba "Venda" com os itens carregados.
- Fora da janela (WASM) → ações desabilitadas com motivo. Só admin vê (o login já é admin-only).

### Responsivo (todas as telas — base única, D6)
- **Shell**: sidebar off-canvas < `md` (botão hambúrguer); conteúdo `w-full`, sem `overflow-x`.
- **Dashboard/stat tiles**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- **Tabelas** (livros/vendas/lançamentos/usuários): tabela ≥ `md`; **cards empilhados** < `md` (mesmos
  dados essenciais).
- **Caixa**: colunas empilham (busca+carrinho, depois pagamento); alvos de toque ≥ 40px; input maquininha
  (já implementado na paridade 1+2).
- **Aceite**: nenhuma tela com rolagem horizontal em ~360px (SC-006); desktop inalterado (SC-008).
