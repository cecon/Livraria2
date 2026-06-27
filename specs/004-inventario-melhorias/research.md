# Phase 0 — Research & Decisions (base do ADR-0012)

## D1 — Identidade do livro: `id` PK + `codigo` único

**Decision**: `livro` passa a ter `id INTEGER PRIMARY KEY AUTOINCREMENT`. `codigo` (código de barras EAN/ISBN) vira `TEXT NOT NULL UNIQUE` e segue como fonte de verdade da bipagem e chave de upsert do legado. A coluna `codigo_barras` é removida.

**Rationale**: Investigação confirmou que `codigo` vem do `cdbar` (código de barras) do legado e faz papel duplo identidade+barcode; `codigo_barras` é redundante (importação grava sempre `None`, bipagem casa `codigo OR codigo_barras`). Um surrogate `id` desacopla identidade de barcode e dá referência numérica estável. Fazer agora (base nova) evita retrofit caro.

**Alternatives considered**:
- Manter `codigo` como PK e só remover `codigo_barras` (KISS) — rejeitado pelo cliente; não dá identidade independente do barcode.
- `id` PK mas filhas continuam por `codigo` (UNIQUE) — rejeitado: meio-termo que não realiza o ganho do surrogate.

## D2 — FKs re-apontadas para `livro(id)`; `item_pedido` é snapshot

**Decision**: `movimento_estoque`, `item_contagem`, `item_lancamento` passam de `livro_codigo TEXT REFERENCES livro(codigo)` para `livro_id INTEGER REFERENCES livro(id)`. `item_pedido` **não** muda: `codigo`/título/preço são snapshot histórico da venda (já hoje não é FK declarada).

**Rationale**: Realiza o desacoplamento. Snapshot de venda deve sobreviver a remoção/alteração do livro — re-apontar perderia essa propriedade.

## D3 — Migração `m004` segura (sem perda de dados)

**Decision**: Nova migração `m004_livro_id` no migrator SeaORM (roda 1×, registrada em `seaql_migrations`), em **transação única**, via **rebuild canônico** do SQLite:
1. Cria `livro_new` (com `id`, `codigo` UNIQUE, sem `codigo_barras`) e copia de `livro` (id auto-atribuído → mapa codigo→id).
2. Para cada filha real: cria `_new` com `livro_id REFERENCES livro(id)` e copia com `JOIN livro_new ON codigo`.
3. **Verifica**: `COUNT(*)` de cada `_new` == tabela original; aborta (rollback) se divergir.
4. `DROP` antigas, `RENAME` novas, recria índices; `PRAGMA foreign_key_check` final.

**Rationale**: SQLite não altera PK/FK no lugar; rebuild é o padrão. Transação + contagem + `foreign_key_check` garantem atomicidade e integridade. O migrator evita re-execução.

**Órfãs pré-existentes (validado na base real)**: a cópia da base de prod revelou 2 linhas filhas apontando para um livro já excluído (`cmmb57324`): `movimento_estoque` id 470 e `item_contagem` id 109 (as FKs nunca foram enforced — `foreign_keys` OFF). A `m004` as **remove de propósito com log** e verifica `count(novo) == count(linhas válidas)` (não o total bruto), garantindo que nenhuma linha que referencia um livro existente seja perdida. `codigo` é único/não-nulo em todos os 498 livros e `codigo_barras` está 0% preenchido (remoção segura).

**Alternatives considered**:
- `ALTER TABLE ... RENAME COLUMN`/add-only — insuficiente para trocar PK e constraints de FK.
- Migração fora de transação com guardas idempotentes manuais — mais frágil que confiar no `seaql_migrations` + transação.

## D4 — Agregados de inventário por função de domínio pura

**Decision**: `domain::inventario::resumir(itens: &[(sistema, contada)]) -> ResumoInventario { total, bateram, faltaram, sobraram, soma_diferencas }`. O adapter busca os itens do snapshot (`item_contagem.qtd_sistema`/`qtd_contada` da sessão fechada) e o caso de uso chama a função pura.

**Rationale**: Princípio I — regra testável sem DB. `bateram` exige o conjunto completo de itens contados (não só divergências), disponível em `item_contagem`.

## D5 — Visualização sem schema novo

**Decision**: Reusa `sessao_inventario.fechada_em` (já existe) e o snapshot `item_contagem.qtd_sistema` (gravado no fechamento, FR-027/002). `SessaoView` ganha `fechada_em`. Nada de tabela nova.

**Rationale**: KISS/YAGNI — os dados de auditoria já são persistidos no fechamento.

## D6 — Pendências: "Já resolvido" reusa baixa existente; reabrir é novo

**Decision**: "Já resolvido" = `resolver_pendencia` (já seta `resolvida=1`). "Cadastrar livro" navega ao cadastro semeando `codigo` e, ao salvar, resolve a pendência. Novo `reabrir_pendencia(id)` (`resolvida=0`). Consulta de resolvidas via `inventario_pendencias(false)` filtrando `resolvida=1`.

**Rationale**: Reuso máximo; só o reabrir é capacidade nova.

## D7 — Remoção da importação: só UI

**Decision**: Comenta o card "Migração/Sincronização do legado" em `Inicio.tsx` (+ estado/handlers/imports). `migrar_legado` e o importador permanecem registrados.

**Rationale**: Decisão do cliente; preserva idempotência do legado (Princípio IV) e permite religar.
