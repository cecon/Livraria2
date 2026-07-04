# Phase 0 — Research & Decisions: Cadastro de formas de pagamento

Base do ADR-0013. Todas as NEEDS CLARIFICATION do Technical Context resolvidas.

## D1 — Modelo de persistência: coluna larga → registro + junção

- **Decisão**: criar `forma_pagamento` (cadastro) e `pagamento_pedido` (junção `pedido`↔`forma`, `valor_centavos`). **Remover** as colunas `val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale` de `pedido`. Armazenamento **esparso**: só grava linha quando `valor > 0`.
- **Rationale**: FR-005 permite o usuário **criar** formas novas. Com colunas fixas, uma forma inventada não teria onde guardar valor. A junção é o modelo mínimo que satisfaz o requisito (não é over-engineering — KISS atendido pela necessidade real). Esparso mantém a tabela pequena e os relatórios diretos.
- **Alternativas consideradas**:
  - *Manter colunas largas + tabela só de rótulos*: rejeitada — não suporta formas criadas pelo usuário (quebra FR-005/FR-012).
  - *JSON de pagamentos em `pedido`*: rejeitada — dificulta agregação SQL nos relatórios e fere a clareza relacional; perde verificação por linha.

## D2 — Identidade estável vs rótulo ("Cartão" → "Crédito")

- **Decisão**: cada forma tem `chave` estável (snake_case, imutável) **e** `rotulo` (editável). "Cartão" é semeado como `chave='credito', rotulo='Crédito'` — **mesma identidade**, valores históricos de cartão passam a pertencer a Crédito sem reclassificação (FR-003). Comportamento (troco, legado, agregação) referencia **chave/id**, nunca o rótulo.
- **Rationale**: permite renomear livremente (FR-006) sem quebrar troco/importador; preserva histórico financeiro.
- **Alternativas**: usar o rótulo como identidade — rejeitada (renomear quebraria comportamento e histórico).

## D3 — Formas "de sistema" (FR-001a)

- **Decisão**: flag `de_sistema` (bool). São de sistema: **dinheiro** (âncora do troco) e os alvos do importador do legado — **credito, pix, ministerio, vale**. Não podem ser excluídas nem desativadas; podem ser renomeadas/reordenadas. **debito** e **pix_igreja** (e futuras) são livres.
- **Rationale**: protege invariantes (troco só do Dinheiro; importador nunca fica órfão) sem travar a liberdade do cadastro. Decisão registrada na sessão de clarificação do spec.
- **Alternativas**: proteger só Dinheiro (B) — rejeitada: o importador (`de_legado_metodo`) mapeia para credito/pix/ministerio/vale; se excluídas, a importação falharia/cairia em default silencioso. Nenhuma proteção (C) — rejeitada: frágil demais para dados financeiros.

## D4 — Estratégia de migração `m006` (boot-applied, espelha m004/ADR-0012)

- **Decisão**: módulo `migration/m006.rs` chamado em `adapters/persistencia/mod.rs` **após** `m004::aplicar` (não é uma seaql migration — precisa de verificação customizada). Idempotente **por estado** (não roda se `forma_pagamento` já existe / `pedido` já não tem `val_cartao`). Em **transação única**:
  1. cria `forma_pagamento` + `pagamento_pedido`;
  2. semeia as 7 formas (ordem canônica, todas ativas, flags `de_sistema`);
  3. backfill: para cada `pedido` e cada coluna `val_*` > 0, `INSERT` em `pagamento_pedido` (forma por chave);
  4. **verificação anti-perda**: para todo pedido, `Σ pagamento_pedido.valor_centavos == (val_cartao+val_dinheiro+val_pix+val_ministerio+val_vale)`; e Σ global por forma confere — senão **rollback**;
     - **Comportamento em falha (FR-016a, clarificado 2026-07-03)**: após o rollback, `aplicar()` retorna `Err` e o boot **propaga** o erro — o app NÃO abre para operação; a UI exibe mensagem clara (atualização falhou; nenhum dado perdido; resolver antes de vender). Sem modo degradado nem retry silencioso.
  5. rebuild de `pedido` sem as colunas `val_*` (CREATE `pedido_new`, copia `numero,cliente,turno,data,total_centavos,cancelado,cancelado_em`, drop+rename);
  6. `PRAGMA foreign_key_check` limpo;
  7. commit.
- **Rationale**: mesmo padrão validado na m004 (rebuild atômico + verificação + foreign_key_check). Σ por venda é mais forte que contagem de linhas (detecta valor trocado, não só linha perdida). `seaql_migrations` continua para DDL simples; o rebuild verificado fica no módulo boot-applied, como já é o caso da m004.
- **Numeração**: o nome `m005_pedido_cancelado` já existe em `seaql_migrations` (migração de cancelamento). Para evitar colisão/confusão, o módulo de rebuild chama-se **m006** mesmo sendo a feature 005. Documentado no ADR-0013.
- **Alternativas**: seaql migration pura com `ALTER`/`CREATE IF NOT EXISTS` — rejeitada: SQLite não dropa coluna sem rebuild, e não há ponto para verificação de Σ. Backfill fora de transação — rejeitada (risco de estado parcial).

## D5 — `Pagamentos` no domínio: struct fixa → lista pura

- **Decisão**: `Pagamentos` vira `Vec<Recebimento { forma_id: i64, valor: Dinheiro }>` (puro, sem ORM). `pago()` = Σ. Troco calculado por `troco(dinheiro_forma_id)`: a aplicação resolve a forma de sistema `dinheiro` (por chave) e passa o id; o domínio garante "excedente ≤ valor recebido em Dinheiro" (FR-013), sem conhecer rótulo nem banco.
- **Rationale**: mantém o domínio puro (Princípio I) e a regra de troco intacta, parametrizada pela chave estável.
- **Alternativas**: manter 5 campos no domínio — rejeitada (não comporta formas novas).

## D6 — Relatórios dinâmicos

- **Decisão**: `ResumoVendas` deixa de ter campos fixos (cartao/dinheiro/…); passa a `Vec<{ forma_id, rotulo, total_centavos }>` ordenado por `ordem`, mais `subtotal_centavos`. `PedidoRelatorio` carrega `recebimentos: Vec<{forma_id, chave, rotulo, valor_centavos}>`. A UI (`RelatoriosViews`, `ListaVendas`) itera dinamicamente. Relatórios de períodos anteriores batem (FR-019/FR-020) porque os valores foram preservados pela m006.
- **Rationale**: suporta formas arbitrárias e mantém o total geral = Σ formas.
- **Alternativas**: manter DTO fixo com as 7 formas — rejeitada (não escala para formas criadas; reintroduz acoplamento por rótulo).

## D7 — UI do PDV e do cadastro

- **Decisão**: PDV carrega `listar_formas_ativas` via IPC e renderiza um `PaymentRow` por forma (na `ordem`); troco amarrado à forma cuja `chave='dinheiro'`. `venda.ts` deixa de ter `FormaKey` fixo — `Pagamentos` é um mapa `forma_id → centavos` derivado das formas carregadas (funções puras parametrizadas, ainda testáveis). Cadastro em tela própria (`FormasPagamento.tsx`) com lista (reordenar/ativar/excluir) e formulário (criar/renomear).
- **Rationale**: remove a lista fixa do front (FR-012); reusa `PaymentRow`; mantém pureza testável de `venda.ts`.
- **Alternativas**: hardcode das 7 formas no front — rejeitada (quebra US2/FR-005 e duplica verdade).

## D8 — Importador do legado por chave

- **Decisão**: `de_legado_metodo` continua mapeando `vdmetodo`/colunas `vdcartao…` para **chaves** (`credito,dinheiro,pix,ministerio,vale`), e o adapter resolve `chave → forma_id` no momento de gravar. Default segue `dinheiro`. Como esses alvos são formas de sistema, o vínculo nunca fica órfão (FR-018).
- **Rationale**: preserva a semântica da ADR-0006 sob o novo modelo; "cartão de crédito" do legado → Crédito.
- **Alternativas**: mapear por id fixo — rejeitada (ids são AUTOINCREMENT, não estáveis entre bases; chave é o contrato estável).

## D9 — Unicidade de rótulo: comparação normalizada (clarificado 2026-07-03)

- **Decisão**: a checagem de rótulo duplicado entre formas **ativas** (FR-010) compara de forma **insensível a caixa e acentos**, com espaços das pontas aparados ("credito" = "Crédito" = " CRÉDITO "). A mesma regra bloqueia a **reativação** de uma forma inativa cujo nome conflite com uma ativa (FR-007): mensagem clara pedindo renomear antes — **sem renome automático**.
- **Rationale**: coerente com o Princípio VI (buscas insensíveis a acento/caixa); evita duplicatas visualmente idênticas no PDV; bloquear a reativação preserva a invariante do FR-010 sem alterar dados por conta própria.
- **Implementação**: normalização como função **pura no domínio** (ex.: `nome_normalizado(&str) -> String` — trim + lowercase + remoção de diacríticos, sem dependência nova); usada por `criar`, `renomear` e `definir_ativa(true)`.
- **Alternativas**: comparação exata — rejeitada (permite "credito"/"Crédito" coexistirem); renome automático com sufixo — rejeitada (mudança silenciosa de dado do usuário).

## Riscos & mitigação

- **Amplitude** (domínio→persistência→comandos→UI→legado): mitigada por sequenciamento em camadas e testes por camada.
- **Perda/duplicação de valor** na migração: mitigada por Σ por venda + Σ global + `foreign_key_check` em transação única, com testes sobre base populada (inclui vendas importadas do legado e o caso de pedido com pagamento zero/esparso).
- **300 linhas**: extrair `pagamento_pedido_sql.rs` e componentes de cadastro; hook de guardrail valida.
- **Lockfile npm** (memória): nenhuma dependência nova; não tocar `package-lock.json`.
