# Contracts — Comandos Tauri (invoke) — 006

Convenções atuais: payload camelCase (serde `rename_all`), dinheiro em `*Centavos: number`
(inteiro), erros como `ErroIpc { codigo, mensagem }`. Tipos TS em `src/lib/types.ts`;
bindings em `src/lib/ipc_destinacoes.ts` (novos) e `ipc_compras.ts` (alterados).

## Novos — cadastro de destinações (US3)

```ts
// Espelha o contrato do cadastro de formas (005)
destinacoes_listar(): Destinacao[]                    // todas, ordenadas por `ordem`
destinacoes_listar_ativas(): Destinacao[]             // para selects de doação
destinacao_criar({ nome }): Destinacao                // erro: nome vazio/duplicado (norm.)
destinacao_renomear({ id, nome }): void               // erro: duplicado entre ativas
destinacao_definir_ativa({ id, ativa }): void         // erro: Loja (de_sistema)
destinacao_reordenar({ ids }): void                   // ids das ESPECIAIS na nova ordem; Loja fixa no topo
destinacao_excluir({ id }): void                      // erro: de_sistema OU em_uso → oferecer desativar

interface Destinacao {
  id: number; nome: string; deSistema: boolean; ativa: boolean; ordem: number;
}
```

## Novos — relatório e consulta (US2)

```ts
relatorio_destinacoes({ inicio, fim }): RelatorioDestinacoes   // datas ISO (YYYY-MM-DD), inclusivas

interface RelatorioDestinacoes {
  inicio: string; fim: string;
  totalCentavos: number;                    // total vendido no período (pedidos não cancelados)
  linhas: { destinacaoId: number;           // Loja vem com o id real; seu valor é derivado
            nome: string;                    //   (total − Σ demais) e cobre livre + carimbo Loja
            qtd: number;
            valorCentavos: number }[];      // Σ linhas === totalCentavos (SC-003)
}

destinacao_saldos_livro({ livroId }): SaldoLivro     // para rateio, transferência e depuração
interface SaldoLivro {
  estoque: number; livre: number;
  carimbos: { destinacaoId: number; nome: string; qtd: number }[];
}
```

## Novos — destinar estoque existente (US4)

```ts
// null = saldo livre. Guards: de !== para; origem com saldo suficiente
// (erro 'saldo_insuficiente' com o disponível na mensagem); destino especial ativo.
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

## Alterados — lançamentos (US1)

```ts
// Criação ganha tipo e campos de doação (compra permanece igual — tipo default 'compra')
lancamento_criar({ fornecedorId?, tipo?: 'compra' | 'doacao' }): LancamentoDetalhe

// Só para nota 'doacao' (erro se chamada em 'compra' ou nota finalizada):
lancamento_definir_doacao({ id, doador?: string, padrao?: PadraoDestinacao }): void
type PadraoDestinacao = { destinacaoId: number; pct: number }[]   // pct inteiro, Σ = 100

// Item em nota 'doacao': custo é ignorado (entra 0); rateio opcional
// (default: aplica o padrão da nota via ratear_percentual)
lancamento_adicionar_item({ id, codigo, qtd, rateio?: RateioItem }): LancamentoDetalhe
lancamento_definir_rateio_item({ id, itemId, rateio: RateioItem }): LancamentoDetalhe
type RateioItem = { destinacaoId: number; qtd: number }[]  // inclui Loja; Σ = qtd do item (tudo carimba)

// Finalizar/cancelar: mesmos comandos, novas regras
lancamento_finalizar({ id })   // doação: valida rateios (Σ ≤ qtd), entrada custo 0 + carimbos
lancamento_cancelar({ id })    // doação: guard adicional — saldo carimbado ≥ rateios da nota
                               //   erro codigo: 'carimbo_consumido' (mensagem clara na UI)

// LancamentoDetalhe ganha: tipo, doador?, padrao?, e cada item: rateio?: RateioItem
```

## Alterados — vendas (US2, leitura)

```ts
// Detalhe da venda (ListaVendas): cada item passa a incluir a distribuição.
// Backend consolida carimbo Loja + livre numa única entrada "Loja" (a UI não faz conta).
interface ItemVendaDetalhe {
  /* campos atuais */
  alocacoes?: { destinacaoId: number; nome: string;
                qtd: number; valorCentavos: number }[];
}
```

## Sem alteração (garantias)

- `registrar_venda` — payload e resposta **idênticos** (SC-002); consumo de carimbos e gravação
  de alocações são efeitos internos da transação.
- PDV, inventário e ajuste: nenhum comando muda de assinatura; a regra de consumo é interna.
  Os estados visuais do PDV (US5 — caixa livre e confirmação animada) são frontend puro: a
  resposta atual de `registrar_venda` já traz total/troco suficientes para a animação.
- Importador do legado: intocado (vendas antigas = Loja por definição — D1/D3).
