# ADR-0013 — Cadastro de formas de pagamento: registro + junção, chave estável e migração m006

**Status**: Aceito · **Data**: 2026-07-04

## Contexto
As formas de pagamento eram um **enum fixo** no domínio (`Cartao/Dinheiro/Pix/Ministerio/ValePresente`)
com **colunas largas** em `pedido` (`val_cartao/val_dinheiro/val_pix/val_ministerio/val_vale`). A feature
005 exige renomear "Cartão"→"Crédito" (mesma identidade), adicionar **Débito** e **PIX Igreja**, e dar ao
usuário um **cadastro gerenciável** (criar/renomear/reordenar/ativar-desativar) — uma forma criada pelo
usuário não teria onde guardar valor no modelo de colunas fixas. As FKs do SQLite **não são enforced em
runtime** (memória do projeto), então checagens de integridade precisam ser explícitas.

## Decisão (research.md D1–D9)
- **Registro + junção**: tabela `forma_pagamento` (cadastro: `id`, `chave` UNIQUE estável, `rotulo`
  editável, `de_sistema`, `ativa`, `ordem`) e `pagamento_pedido` (junção `pedido↔forma`, `valor_centavos`,
  PK composta, esparsa — só valor > 0). As colunas `val_*` de `pedido` são **removidas** (rebuild).
- **Identidade por chave**: comportamento (troco, importador do legado, seed) referencia a `chave`
  snake_case imutável, nunca o rótulo. "Cartão" é semeado como `chave='credito', rotulo='Crédito'` —
  mesma identidade, histórico preservado sem reclassificação.
- **Formas de sistema** (`de_sistema=1`, não excluíveis/desativáveis; renomeáveis/reordenáveis):
  `dinheiro` (âncora do troco) e os alvos do legado `credito`, `pix`, `ministerio`, `vale`.
  `debito`, `pix_igreja` e formas criadas pelo usuário são livres.
- **Domínio puro**: `Pagamentos` vira `Vec<Recebimento{forma_id, valor}>`; troco por
  `troco(dinheiro_forma_id)` (excedente ≤ recebido em Dinheiro). `nome_normalizado()` (trim + lowercase +
  sem diacríticos) é a régua de unicidade de rótulo entre ativas e do bloqueio de **reativação** com nome
  conflitante (sem renome automático).
- **Migração `m006`** (boot-applied, espelha m004/ADR-0012): transação única — cria tabelas, semeia as 7
  formas (todas ativas), backfill `val_* > 0` → linhas por chave, **verificação anti-perda** (Σ por pedido
  e Σ global por forma), rebuild de `pedido` sem `val_*`, `foreign_key_check` limpo. Idempotente por
  estado. **Em falha**: rollback (dados intactos), `aplicar()` retorna `Err`, o boot expõe `estado_boot`
  e a UI bloqueia a operação com mensagem clara (FR-016a) — sem modo degradado.
- **Numeração**: o módulo chama-se `m006` (a `seaql_migrations` já tem `m005_pedido_cancelado`), mesmo
  sendo a feature 005.

## Alternativas rejeitadas
- Colunas largas + tabela só de rótulos: não suporta formas criadas pelo usuário (FR-005).
- JSON de pagamentos em `pedido`: perde agregação SQL e verificação por linha.
- Proteger só Dinheiro: importador do legado ficaria órfão se credito/pix/ministerio/vale sumissem.
- Identidade pelo rótulo: renomear quebraria troco/importador/histórico.
- Comparação exata de nomes: permitiria "credito"/"Crédito" ativas simultâneas.

## Consequências
- **Positivas**: usuário autônomo para gerir formas; histórico financeiro preservado e verificado por Σ;
  relatórios dinâmicos (total geral = Σ formas); troco e legado imunes a renomeação.
- **Custos**: refatoração ampla (domínio → persistência → comandos → UI → importador); DTOs de relatório
  deixam de ter campos fixos; UI do PDV passa a depender de `listar_formas_ativas`.

## Notas as-built
- **FKs estão ON no runtime atual**: ao contrário do que a memória do projeto registrava, o sqlx/SeaORM
  conecta com `PRAGMA foreign_keys = ON` por default — o `DROP TABLE pedido` do rebuild falhou nos testes
  com "FOREIGN KEY constraint failed". Solução (mesma da m004): a m006 reconstrói **também `item_pedido`**
  (cópia integral para `item_pedido_new` → `pedido_new`) e cria `pagamento_pedido` já referenciando
  `pedido_new`; o rename final reescreve as FKs para `pedido`. A checagem explícita de `em_uso` (FR-017)
  foi mantida — órfãs históricas podem existir em bases antigas.
- Verificação adicional de cópia (count de `pedido`/`item_pedido` antes/depois) além das Σ por venda e
  por forma; testes em `src-tauri/tests/migracao_m006.rs` cobrem backfill, idempotência, base vazia,
  esparso e falha simulada com rollback (FR-016a).
- `estado_boot` implementado em `commands_formas.rs` (com `BootState` gerenciado); o setup do `lib.rs`
  captura o `Err` da migração em vez de abortar o processo, e `App.tsx` renderiza `ErroMigracao.tsx`.
- Normalização de nomes (`nome_normalizado`) implementada com mapa fixo de diacríticos pt-BR no domínio
  (sem dependência nova); geração de `chave` com sufixo `_2`, `_3`… para colisões.
- UI: rota `/formas-pagamento` na navegação; PDV carrega `listar_formas_ativas` e mapeia ícones por
  chave (fallback genérico para formas criadas pelo usuário); exportações (PDF/Excel/WhatsApp) e
  relatórios iteram o resumo dinâmico.
