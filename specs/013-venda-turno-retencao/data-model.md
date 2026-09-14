# Data Model — feature 013 (venda vinculada a turno, sync só-sobe, retenção 45d)

Fonte: spec.md + plan.md. Reusa a base da feature 009 (turno) e 011 (saldo publicado).

## 1. Deltas de esquema (SQLite local — migração `m014`, idempotente)

`ADD COLUMN` ignorando "duplicate column" (padrão m006/m008), registrada no boot após m013.

| Tabela | Coluna NOVA | Tipo | Semântica |
|---|---|---|---|
| `turno_operacao` | `maquina` | `TEXT` | Nome do PC (hostname) onde o turno foi aberto. Compõe a identidade (FR-015), aparece no header (FR-021) e **sobe** no sync. |
| `pedido` | `ja_sincronizado` | `INTEGER NOT NULL DEFAULT 0` | `1` a partir do 1º push confirmado; **nunca** volta a `0` (nem no cancelamento). Base local do `+cancelamento` do saldo operacional (FR-006). |

### Colunas JÁ existentes (não recriar)
- **m009**: `pedido.turno_uid` (FK lógica → `turno_operacao.sync_uid`, pode ser nulo em legado),
  `pedido.numero_no_turno` (INTEGER, 1..N por turno — já sincroniza via `replica_mapa`).
- **m008/sync**: `pedido.sync_uid`, `origem`, `atualizado_em`, `excluido_em`, `sincronizado_em`.
- **m011**: `livro.saldo_publicado`, `pedido.estoque_status` (**deixa de ser lido pelo saldo**; segue existindo para leitura/histórico).
- **turno_operacao** (m009): `sync_uid` (PK), `operador`, `caixa_inicial_centavos`, `status`
  (`aberto`|`encerrado`), `abertura`, `encerramento`, `esperado/conferido/diferenca_centavos`,
  cols de sync.

## 2. Entidades e regras

### Turno de operação
- **Identidade**: `sync_uid` (global, único por PDV — sem colisão no push) + **`maquina`** + `operador` (quem abriu) + `abertura`.
- **Estados**: `aberto → encerrado`. **Invariante: no máximo 1 `aberto` por PDV** (FR-017).
- **Transições**: abrir (só se não há aberto), encerrar (local, ou vindo da nuvem — desce, FR-019), reconciliação (novo turno para pendências, FR-024).
- **Terminologia**: UI "Fechar/Fechado" ↔ dado `encerrado` (comparar sempre `'encerrado'`).

### Venda (pedido)
- Pertence a **um** turno (`turno_uid`); vendas novas exigem turno aberto (FR-001/002).
- **Número exibido** = `numero_no_turno` (1..N por turno, via domínio `proximo_numero(qtd_no_turno)`).
  **`numero`** (contínuo global) permanece PK/FK interno (Princípio VI — ADR-0025).
- **Estado de envio**: `sincronizado_em` (NULL = pendente de push; zera no cancelamento para re-subir)
  × `ja_sincronizado` (persistente: "a nuvem já baixou").
- Cancelamento: só se `turno_uid == turno_aberto` (FR-003); marca `cancelado=1`, `sincronizado_em=NULL`, **mantém** `ja_sincronizado`.

### Saldo operacional (fórmula final — `estoque_repo::saldo_operacional`)
```
saldo_publicado
  − Σ item.qtd  WHERE cancelado=0 AND sincronizado_em IS NULL           -- venda pendente
  + Σ item.qtd  WHERE cancelado=1 AND sincronizado_em IS NULL
                       AND ja_sincronizado = 1                          -- ← troca estoque_status
```
Offline sell→cancel (nunca subiu → `ja_sincronizado=0`) = net zero. Venda sincronizada→cancel (`=1`) = `+qtd`.

## 3. Sincronização (`replica_mapa`)
- **push_only** (não descem): `pedido`, `item_pedido`, `pagamento_pedido`, `alocacao_venda`.
- **bidirecional**: `turno_operacao` (fechamento desce; `maquina` sobe).
- **pull normal**: `livro` (traz `saldo_publicado`).
- Ordem de push mantém `ORDEM_DEPENDENCIA` (turno antes de pedido).

## 4. Poda local (retenção 45d)
- **Alvo**: `turno_operacao` com `status='encerrado'` **E** todas as linhas do turno com `sincronizado_em NOT NULL` **E** `data < hoje-45`.
- **Cascata filha→pai (FK-safe)**: `alocacao_venda` → `pagamento_pedido` → `item_pedido` → `pedido` → `turno_operacao`.
- **Nunca** toca `livro`/`saldo_publicado`/`movimento_estoque`. Só local; a nuvem retém tudo.

## 5. Nuvem (Postgres — migração `0014`, idempotente)
- **Turno padrão global** (fechado/conferido) criado `if not exists` (identidade determinística).
- `UPDATE pedido SET turno_uid = <padrão> WHERE turno_uid IS NULL` → zero venda órfã (SC-009).
