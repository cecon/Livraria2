# ADR-0012 — Identidade do livro: `id` numérico e `codigo` (barcode) único

**Status**: Aceito · **Data**: 2026-06-27

## Contexto
A tabela `livro` usava `codigo TEXT PRIMARY KEY` em papel duplo: identidade **e** código de barras (vem do
`cdbar` do legado, um EAN/ISBN). A coluna `codigo_barras`, adicionada na feature 002, ficou **redundante e
não usada** (importação grava sempre `None`; a bipagem casava `codigo OR codigo_barras`). Acoplar a
identidade ao barcode é frágil (barcode pode ser corrigido/ausente) e a base real já tinha **linhas órfãs**
em tabelas filhas (FKs nunca enforced — `foreign_keys` OFF), de um livro excluído (`cmmb57324`).

## Decisão
- `livro` passa a ter **`id INTEGER PRIMARY KEY AUTOINCREMENT`** como identidade interna estável.
- `codigo` (código de barras EAN/ISBN) vira **`UNIQUE NOT NULL`** e segue como **fonte de verdade** da
  bipagem e **chave de upsert** do legado (`ON CONFLICT(codigo)`, Princípio IV preservado).
- A coluna **`codigo_barras` é removida**; bipagem/busca casam **somente `codigo`**.
- As FKs reais (`movimento_estoque`, `item_contagem`, `item_lancamento`) são **re-apontadas para
  `livro(id)`** (`livro_codigo` → `livro_id`). `item_pedido` permanece **snapshot histórico** por `codigo`
  (não é FK) e **não** é alterado.
- A camada de aplicação/domínio continua endereçando o livro por `codigo`; o `livro_id` é resolvido no
  **limite do SQL** (insert via `(SELECT id FROM livro WHERE codigo = ?)`, leitura via `JOIN ON l.id =
  child.livro_id`). Confina a mudança aos adapters.

## Migração (`migration/m004.rs`)
Rebuild canônico do SQLite em **transação única**, idempotente por estado (`ja_aplicada`: existe coluna
`id`?) e registrado/aplicado no boot por `inicializar_schema` após as migrations versionadas:
1. cria `livro_new` (id, codigo único, sem `codigo_barras`) e copia;
2. recria as filhas com `livro_id REFERENCES livro_new(id)` (o SQLite reescreve a FK para `livro(id)` no
   rename), copiando via `JOIN livro_new ON codigo` — o **INNER JOIN descarta órfãs** de propósito;
3. **verificação anti-perda**: `count(novo) == count(linhas válidas)` por tabela, senão `Err` → rollback;
4. troca atômica (drop + rename), recria índices, `PRAGMA foreign_key_check` limpo, commit.

As órfãs removidas são **logadas** (tabela + quantidade).

## Consequências
- **Positivas**: identidade desacoplada do barcode; integridade referencial saneada (órfãs removidas);
  modelo mais limpo; `codigo` único habilita upsert seguro.
- **Custos**: refatoração ampla da persistência (`livro_codigo`→`livro_id`) e dos sites que construíam
  `Livro` com `codigo_barras`. Validado contra a base real (498 livros preservados, 2 órfãs descartadas,
  `foreign_key_check` limpo, idempotente) e por `tests/migracao_m004.rs`.
- **Snapshot de venda**: `item_pedido` mantém `codigo`/título/preço congelados (history-safe).
