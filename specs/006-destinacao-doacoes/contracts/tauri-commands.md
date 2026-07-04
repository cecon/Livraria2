# Contracts — Comandos Tauri (invoke) — 006

Convenções atuais: payload camelCase (serde `rename_all`), dinheiro em `*Centavos: number`
(inteiro), erros como `ErroIpc { codigo, mensagem }`. Tipos TS em `src/lib/types.ts`;
bindings em `src/lib/ipc_destinacoes.ts` (novos).

## Novos — cadastro de destinações (US3)

```ts
// Espelha o contrato do cadastro de formas (005)
destinacoes_listar(): Destinacao[]                    // todas, ordenadas por `ordem`
destinacoes_listar_ativas(): Destinacao[]             // para selects de transferência
destinacao_criar({ nome }): Destinacao                // erro: nome vazio/duplicado (norm.)
destinacao_renomear({ id, nome }): void               // erro: duplicado entre ativas
destinacao_definir_ativa({ id, ativa }): void         // erro: Loja (de_sistema)
destinacao_reordenar({ ids }): void                   // ids das ESPECIAIS na nova ordem; Loja fixa no topo
destinacao_excluir({ id }): void                      // erro: de_sistema OU em_uso → oferecer desativar

interface Destinacao {
  id: number; nome: string; deSistema: boolean; ativa: boolean; ordem: number;
}
```

## Novos — destinar estoque (US1)

```ts
destinacao_saldos_livro({ livroId }): SaldoLivro      // para a tela de transferência
interface SaldoLivro {
  estoque: number; livre: number;
  carimbos: { destinacaoId: number; nome: string; qtd: number }[];
}

// null = saldo livre. Guards: de !== para; origem com saldo suficiente
// (erro 'saldo_insuficiente' com o disponível na mensagem); destino ativo.
destinacao_transferir({
  livroId, deDestinacaoId: number | null, paraDestinacaoId: number | null,
  qtd, motivo?: string
}): SaldoLivro                                        // saldos atualizados p/ a UI

destinacao_transferencias_livro({ livroId }): Transferencia[]   // histórico (mais recente 1º)
interface Transferencia {
  id: number; de: string; para: string;               // "Livre" quando null
  qtd: number; motivo: string | null; criadoEm: string;
}
```

## Novos — relatório e posição (US2)

```ts
relatorio_destinacoes({ inicio, fim }): RelatorioDestinacoes   // datas ISO (YYYY-MM-DD), inclusivas

interface RelatorioDestinacoes {
  inicio: string; fim: string;
  totalCentavos: number;                    // total vendido no período (pedidos não cancelados)
  linhas: { destinacaoId: number;           // Loja vem com o id real; seu valor é derivado
            nome: string;                    //   (total − Σ demais) e cobre livre + carimbo Loja
            qtd: number;
            valorCentavos: number }[];      // Σ linhas === totalCentavos (SC-003)
  posicaoAtual: { destinacaoId: number; nome: string;
                  qtd: number }[];          // FR-018 — Σ destinacao_saldo, independe do período
}
```

## Alterados — vendas

```ts
// Detalhe da venda (ListaVendas): cada item passa a incluir a distribuição.
// Backend consolida carimbo Loja + livre numa única entrada "Loja" (a UI não faz conta).
interface ItemVendaDetalhe {
  /* campos atuais */
  alocacoes?: { destinacaoId: number; nome: string;
                qtd: number; valorCentavos: number }[];
}

// Cancelamento de venda: comando existente `excluir_pedido` (commands.rs), novo guard (FR-011)
excluir_pedido({ numero })   // erro 'venda_antiga' quando > 5 dias corridos da venda
```

## Sem alteração (garantias)

- `registrar_venda` — payload e resposta **idênticos** (SC-002); consumo de carimbos e gravação
  de alocações são efeitos internos da transação.
- **Lançamentos de entrada: intocados** (sem tipo de nota, doador ou rateio — Clarifications
  2026-07-04). O estorno físico do cancelamento passa a consumir carimbos pela regra de perda,
  internamente, sem mudança de assinatura.
- PDV, inventário e ajuste: nenhum comando muda de assinatura; a regra de consumo é interna.
  Os estados visuais do PDV (US4 — caixa livre e confirmação animada) são frontend puro: a
  resposta atual de `registrar_venda` já traz total/troco suficientes para a animação.
- Importador do legado: intocado (vendas antigas = Loja por definição — D1/D3).
