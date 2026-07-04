# Phase 1 — Data Model: Cadastro de formas de pagamento

## Visão geral

De **colunas largas** em `pedido` para **registro + junção**:

```
forma_pagamento (cadastro)          pagamento_pedido (junção)         pedido (sem val_*)
─────────────────────────           ─────────────────────────         ──────────────────
id (PK)                  ◄───────────  forma_id (FK)                    numero (PK)  ◄──┐
chave (UNIQUE, estável)               pedido_numero (FK)  ──────────────────────────────┘
rotulo                                valor_centavos
de_sistema                            PK(pedido_numero, forma_id)
ativa
ordem
```

## Entidade: `forma_pagamento`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | identidade técnica (FK alvo) |
| `chave` | TEXT NOT NULL UNIQUE | identidade **estável** em snake_case; imutável; usada por troco/legado/seed |
| `rotulo` | TEXT NOT NULL | rótulo exibido; editável (FR-006); não-vazio; único entre **ativas** por comparação **normalizada** — caixa/acentos insensível, espaços aparados (FR-010) |
| `de_sistema` | INTEGER NOT NULL DEFAULT 0 | 1 = não excluível/desativável (FR-001a) |
| `ativa` | INTEGER NOT NULL DEFAULT 1 | inativa some do PDV, permanece em histórico (FR-007) |
| `ordem` | INTEGER NOT NULL DEFAULT 0 | ordem de exibição no PDV/relatórios (FR-008) |

Índice: `CREATE UNIQUE INDEX idx_forma_chave ON forma_pagamento(chave)`.

### Seed inicial (7 formas, todas ativas — FR-002)

| ordem | chave | rotulo | de_sistema |
|---|---|---|---|
| 0 | `credito` | Crédito | 1 (alvo legado; ex-"Cartão") |
| 1 | `debito` | Débito | 0 (nova, livre) |
| 2 | `dinheiro` | Dinheiro | 1 (troco) |
| 3 | `pix` | PIX | 1 (alvo legado) |
| 4 | `pix_igreja` | PIX Igreja | 0 (nova, livre) |
| 5 | `ministerio` | Ministério | 1 (alvo legado) |
| 6 | `vale` | Vale Presente | 1 (alvo legado) |

> A ordem reflete o agrupamento Crédito/Débito juntos; ajustável pelo usuário depois.

### Regras de ciclo de vida (domínio puro)

- **Renomear** (`rotulo`): sempre permitido; valida não-vazio e unicidade entre ativas por **comparação normalizada** (caixa/acentos insensível, trim — FR-010, D9). `chave` nunca muda.
- **Normalização de nome** (função pura do domínio): `trim` + lowercase + remoção de diacríticos; usada em criar, renomear e reativar.
- **Ativar/desativar**: permitido se `de_sistema == 0`; nunca pode resultar em **zero formas ativas** (FR-011). **Reativar** uma forma cujo nome normalizado conflita com uma forma ativa é **bloqueado** com mensagem pedindo renomear antes — sem renome automático (FR-007).
- **Excluir**: permitido se `de_sistema == 0` **e** `em_uso == false` (nenhuma linha em `pagamento_pedido`). Caso contrário, bloquear e oferecer desativar (FR-009). `em_uso` é checado por **SQL explícito** (memória: FKs não enforced em runtime — FR-017).
- **Reordenar**: livre para todas; só muda apresentação (não toca histórico).

## Entidade: `pagamento_pedido` (junção)

| Campo | Tipo | Regras |
|---|---|---|
| `pedido_numero` | INTEGER NOT NULL REFERENCES pedido(numero) | venda |
| `forma_id` | INTEGER NOT NULL REFERENCES forma_pagamento(id) | forma |
| `valor_centavos` | INTEGER NOT NULL | inteiro de centavos (skill dinheiro-em-centavos); só grava se `> 0` (esparso) |

Chave primária composta: `PRIMARY KEY(pedido_numero, forma_id)`.
Índice: `CREATE INDEX idx_pag_pedido ON pagamento_pedido(pedido_numero)`.

Invariante: para um pedido, `Σ valor_centavos` = total **pago** (que pode diferir de `pedido.total_centavos` em vendas sub/sobre-pagas — preservado como está).

## Entidade alterada: `pedido`

- **Remove**: `val_cartao`, `val_dinheiro`, `val_pix`, `val_ministerio`, `val_vale`.
- **Mantém**: `numero`, `cliente`, `turno`, `data`, `total_centavos`, `cancelado`, `cancelado_em`.

## Domínio (Rust puro)

```text
FormaPagamento { id: i64, chave: String, rotulo: String, de_sistema: bool, ativa: bool, ordem: i64 }
ChaveSistema  -> enum estável { Credito, Debito?, Dinheiro, Pix, Ministerio, Vale }  // chaves p/ troco+legado
                 (apenas as de sistema precisam de chave conhecida em código)
Recebimento   { forma_id: i64, valor: Dinheiro }
Pagamentos    = Vec<Recebimento>            // pago() = Σ valor; por_forma_id(id)
```

- `de_legado_metodo(codigo) -> ChaveSistema` (mantém C→Credito, P→Pix, M→Ministerio, V→Vale, default→Dinheiro).
- Troco: `Pedido::troco(dinheiro_forma_id)` — excedente sobre o total só é válido até o valor recebido na forma Dinheiro (FR-013).

## Migração `m006` (passos, transação única — espelha m004)

1. **Idempotência por estado**: se `forma_pagamento` existe (ou `pedido` não tem `val_cartao`), retorna sem fazer nada.
2. **Contagens/somas de referência** (antes de qualquer DROP): `count(pedido)`, e por pedido `Σ val_*`.
3. **Cria** `forma_pagamento` (+ índice) e `pagamento_pedido` (+ índice).
4. **Semeia** as 7 formas (tabela acima).
5. **Backfill**: para cada coluna `val_x > 0`, `INSERT INTO pagamento_pedido SELECT numero, (forma_id de chave x), val_x FROM pedido WHERE val_x > 0`.
6. **Verificação anti-perda** (rollback se falhar):
   - por pedido: `Σ pagamento_pedido.valor_centavos == (val_cartao+val_dinheiro+val_pix+val_ministerio+val_vale)`;
   - global por forma: `Σ pagamento_pedido(forma=credito) == Σ val_cartao`, idem para as demais.
7. **Rebuild de `pedido`** sem `val_*`: `CREATE pedido_new(...)` → copia colunas mantidas → `DROP pedido` → `RENAME pedido_new → pedido` → recria índices/PK. **As-built**: o runtime conecta com `foreign_keys=ON` (default do sqlx), então `item_pedido` também é reconstruída (cópia integral → referencia `pedido_new`) e `pagamento_pedido` nasce referenciando `pedido_new`; o rename final reescreve as FKs para `pedido` (padrão da m004), com verificação extra de count na cópia.
8. **`PRAGMA foreign_key_check`** limpo (senão rollback).
9. **commit**. Retorna `RelatorioM006 { formas_semeadas, pedidos, linhas_pagamento, soma_total_centavos }` para log/teste.

**Falha (FR-016a)**: se a verificação (passo 6) ou o `foreign_key_check` (passo 8) divergirem, a transação sofre **rollback** (dados originais intactos, `val_*` preservadas) e `aplicar()` retorna `Err`. O boot propaga o erro e o app **bloqueia a abertura para operação**, exibindo mensagem clara: atualização falhou, nenhum valor foi perdido, resolver antes de registrar vendas. Sem modo degradado.

> Em base **nova** (sem pedidos): passos 4 semeiam as formas, 5–6 não inserem nada (Σ = 0, ok), 7 reconstrói `pedido` vazio. Convergente.

## Relatórios (DTOs dinâmicos)

```text
ResumoVendas { formas: Vec<{ forma_id, rotulo, total_centavos }>, subtotal_centavos }   // ordenado por ordem
PedidoRelatorio { ..., recebimentos: Vec<{ forma_id, chave, rotulo, valor_centavos }> }
```

`subtotal_centavos = Σ formas[].total_centavos` (FR-019; total geral = soma de todas as formas, inclui Ministério/Vale).
