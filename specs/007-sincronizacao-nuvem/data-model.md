# Data Model — Sincronização com a nuvem (007)

Dois esquemas espelhados: **local (SQLite, PDV)** e **nuvem (Postgres/Supabase, hub)**. As tabelas de negócio já existem (features 001–006); esta feature adiciona **colunas de sincronização** e o **espelho na nuvem**. Nenhuma tabela de negócio muda de forma; só ganha metadados de sync.

## 1. Colunas de sincronização (adicionadas às tabelas sincronizáveis)

Aplicadas via `m008` (local) e refletidas no schema da nuvem. Tabelas sincronizáveis (escopo confirmado — Clarificação 2026-07-20): `livro`, `movimento_estoque`, `pedido`, `item_pedido`, `pagamento_pedido` (005), `forma_pagamento` (005), `lancamento_entrada`, `item_lancamento`, `fornecedor` (003), `destinacao`, `transferencia_destinacao`, `alocacao_venda` (006), **`usuario` (operador — só identidade, sem `senha_hash`)**.

> **Atribuição de venda**: `m008` também adiciona `pedido.operador` (referência ao operador), sincronizado; vendas antigas ficam com operador nulo.

| Coluna | Tipo | Papel |
|---|---|---|
| `sync_uid` | TEXT (UUID v4) | **Identidade global estável**, imutável, gerada na origem. Chave de conflito do upsert (D4). |
| `origem` | TEXT (`pdv` \| `escritorio`) | Onde o registro nasceu (auditoria/merge). |
| `atualizado_em` | TEXT (ISO, tempo do servidor) | Base do **last-write-wins** para registros mutáveis (livro) (D7/D9). |
| `excluido_em` | TEXT (ISO) NULL | **Soft delete** (D8). NULL = ativo. |
| `sincronizado_em` | TEXT (ISO) NULL | Local: NULL = **pendente de push**. Marca de reconciliação (D10). |

**Movimentos** (`movimento_estoque`, `item_*`) são **append-only**: recebem `sync_uid`/`origem`/`sincronizado_em`, mas **não** usam `atualizado_em`/`excluido_em` (nunca mudam).

## 2. Migração local `m008` (idempotente, por comando)

Somente aditiva — segue Princípio IV (nenhum rebuild, nenhum ALTER destrutivo):

1. `ALTER TABLE <t> ADD COLUMN sync_uid TEXT` (+ `origem`, `atualizado_em`, `excluido_em`, `sincronizado_em`) para cada tabela sincronizável — via padrão "ADD COLUMN se não existe".
2. **Backfill idempotente** de `sync_uid` para linhas existentes onde `sync_uid IS NULL` (gera UUID; `origem='pdv'`; `atualizado_em` = `criado_em` ou now). Re-executável. Este backfill é o que torna toda a base atual **pendente de push** para o **seed inicial** (D13).
3. `CREATE UNIQUE INDEX IF NOT EXISTS` em `sync_uid` por tabela.
4. **Índices de deduplicação por chave natural** (D4): `livro(codigo_barras)`, **`fornecedor(nome_norm)`** (índice único **já existente** na feature 003; `documento` é desempate opcional) e `usuario(usuario)` (já é PK) — garantem que a merge una registros iguais em vez de duplicar.
5. `ADD COLUMN pedido.operador TEXT` (referência a `usuario.usuario`) — atribuição da venda (nullable; vendas antigas ficam nulas).
6. `CREATE TABLE IF NOT EXISTS sync_cursor (recurso TEXT PRIMARY KEY, last_cursor TEXT NOT NULL DEFAULT '')` — guarda o cursor de pull por tabela/recurso (D10).

> **`usuario.senha_hash` é EXCLUÍDO do payload de sincronização** (identidade sobe, credencial não). Operador criado no escritório chega com `senha_hash` vazio = "pendente"; o PDV bloqueia o login até a senha ser definida localmente.

> Regra de ouro: re-aplicar `m008` em base nova ou já migrada dá o mesmo estado, sem duplicar `sync_uid` nem perder dados.

## 3. Esquema na nuvem (Postgres/Supabase)

Espelho das tabelas sincronizáveis com os mesmos campos de negócio + colunas de sync, mais:

| Coluna (nuvem) | Tipo | Papel |
|---|---|---|
| `sync_uid` | uuid **PRIMARY KEY** | Chave de conflito do upsert (idempotência). |
| `sincronizado_em` | timestamptz `DEFAULT now()` | **Cursor de pull** autoritativo (tempo do servidor, D9). |

- **FKs enforced** (é o motivo de usar Postgres): `movimento_estoque.livro_codigo → livro.codigo`, itens → cabeçalho, etc. Por isso o push é **ordenado** (pais→filhas) e **órfãs são isoladas** (D11).
- **Derivados NÃO existem como verdade na nuvem**: `custo_medio` e saldo são **VIEWS** (`vw_saldo_livro`, `vw_custo_medio`) que fazem o fold sobre `movimento_estoque`, ou recomputados pelo cliente. Nunca colunas sincronizadas (D5).
- **Constraints = fonte única de invariante** para o escritório (que grava direto): `CHECK (qtd <> 0)`, `CHECK (custo_unit_centavos >= 0)`, etc. — evita reimplementar regra de negócio em TS (Princípio II/DRY).
- **RLS** habilitada; acesso só pela chave `anon` com policies que restringem ao workspace (D3). Migrações do schema da nuvem versionadas e idempotentes.

## 4. Entidades e papéis na sincronização

| Entidade | Mutável? | Origem(ns) | Estratégia de merge |
|---|---|---|---|
| `movimento_estoque` | Não (append-only) | PDV (saída/ajuste/contagem), Escritório (entrada) | Upsert por `sync_uid`; união idempotente; ordem só p/ fold (D5/D6). |
| `livro` | Sim (título, preço) | Ambos | Upsert com **dedup por código de barras** + **LWW** por `atualizado_em`; soft delete (D4/D7/D8). |
| `livro.custo_medio_centavos` | Derivado | — | **Recomputado** por fold pós-merge; nunca sincronizado (D5). |
| Saldo do livro | Derivado | — | Soma de `movimento_estoque`; VIEW na nuvem, cálculo atual no PDV. |
| `fornecedor` | Sim | Ambos | Upsert com **dedup por `nome_norm`** (índice único da 003; `documento` desempate) + **LWW**; soft delete (D4/D7). |
| `usuario` (operador) | Sim (identidade) | Ambos | Upsert com **dedup por `usuario`** + **LWW**; **`senha_hash` nunca sincroniza** (fica só no PDV). |
| `pedido` / `item_pedido` / `pagamento_pedido` (venda + forma pgto) | Não | PDV | Upsert por `sync_uid`; venda sobe com forma de pagamento (005) e **operador** atribuído. |
| `lancamento_entrada` / `item_lancamento` | Não | Escritório (e PDV) | Upsert por `sync_uid`; gera as entradas; vincula `fornecedor`. |
| `forma_pagamento` (005) | Sim (cadastro) | PDV (dono); escritório lê | Upsert por `sync_uid`; LWW; replicado p/ relatórios. |
| `destinacao` / `transferencia_destinacao` / `alocacao_venda` (006) | Cadastro mutável / eventos | PDV (dono); escritório lê | Upsert por `sync_uid`; alocações append-only p/ relatório de repasse. |
| `sync_cursor` | Local | PDV | Só local; guarda `last_cursor` por recurso. |

## 5. Invariantes

- Após merge completo dos dois lados: **saldo(livro) idêntico** em PDV e nuvem (SC-003); soma dos movimentos por `livro_codigo` é igual.
- `sync_uid` é **único e imutável**; nunca reatribuído (nem em rebuild — ver memória `sqlite-fks-nao-enforced`: o rebuild deve **preservar** `sync_uid`).
- Re-sync é **no-op** sobre o estado (idempotência, SC-004).
- Nenhum movimento com `livro_codigo` órfão é enviado à nuvem sem isolamento/report (FR-012, D11).
- `custo_medio` na nuvem e no PDV convergem porque ambos foldam o **mesmo** ledger ordenado por `criado_em`.
- **Dedup por chave natural**: nunca existem dois `livro` com o mesmo código de barras nem dois `fornecedor` com o mesmo nome/documento, mesmo que criados independentemente nos dois lados (D4).
- **Seed inicial idempotente** (D13): reexecutar a carga do histórico não duplica nada (upsert por `sync_uid`); órfãs isoladas/reportadas.
- **Autoria/RLS** (D3): toda gravação do escritório é atribuível a um usuário autenticado; acesso confinado por RLS por usuário.
- **Credencial local-only** (D15): `usuario.senha_hash` **nunca** deixa o PDV; a nuvem guarda só a identidade do operador. Dois espaços de identidade (retaguarda = Supabase Auth; operador = login local) não são unificados.
