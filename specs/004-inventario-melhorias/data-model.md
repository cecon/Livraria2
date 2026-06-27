# Phase 1 — Data Model & Migração `m004`

## Esquema novo do `livro`

```text
livro
  id              INTEGER PRIMARY KEY AUTOINCREMENT   -- NOVO: identidade interna estável
  codigo          TEXT NOT NULL UNIQUE                -- barcode EAN/ISBN (fonte de verdade; era PK)
  titulo          TEXT NOT NULL
  autor           TEXT
  preco_centavos  INTEGER NOT NULL DEFAULT 0
  categoria       INTEGER NOT NULL DEFAULT 0
  estoque         INTEGER NOT NULL DEFAULT 0
  descricao       TEXT
  busca_norm      TEXT NOT NULL DEFAULT ''
  ativo           INTEGER NOT NULL DEFAULT 1
  atualizado_em   TEXT NOT NULL DEFAULT ''
  custo_medio_centavos INTEGER NOT NULL DEFAULT 0
  -- REMOVIDO: codigo_barras
índices: idx_livro_busca(busca_norm); UNIQUE(codigo) implícito  (idx_livro_codbarras é DROPADO)
```

### FKs re-apontadas (de `livro_codigo TEXT` → `livro_id INTEGER REFERENCES livro(id)`)

| Tabela | Antes | Depois |
|---|---|---|
| `movimento_estoque` | `livro_codigo TEXT REFERENCES livro(codigo)` | `livro_id INTEGER NOT NULL REFERENCES livro(id)` |
| `item_contagem` | `livro_codigo TEXT REFERENCES livro(codigo)` + `UNIQUE(sessao_id, livro_codigo)` | `livro_id INTEGER NOT NULL REFERENCES livro(id)` + `UNIQUE(sessao_id, livro_id)` |
| `item_lancamento` | `livro_codigo TEXT REFERENCES livro(codigo)` + `UNIQUE(lancamento_id, livro_codigo)` | `livro_id INTEGER NOT NULL REFERENCES livro(id)` + `UNIQUE(lancamento_id, livro_id)` |
| `item_pedido` | `codigo TEXT` (snapshot, **não-FK**) | **inalterado** (snapshot histórico) |
| `pendencia_cadastro` | `codigo_lido TEXT` (texto lido) | **inalterado** (não referencia livro) |

Índices recriados: `idx_mov_livro(livro_id, id)`, `idx_item_lanc(lancamento_id)`.

## Passos da migração `m004_livro_id` (transação única)

> Roda 1× (registrada em `seaql_migrations`). Pseudo-SQL; executar com `foreign_keys` desligado durante o rebuild e religado ao final.

```sql
BEGIN;  -- (a transação do migrator)

-- 1) livro_new com id + codigo único, sem codigo_barras
CREATE TABLE livro_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL, autor TEXT, preco_centavos INTEGER NOT NULL DEFAULT 0,
  categoria INTEGER NOT NULL DEFAULT 0, estoque INTEGER NOT NULL DEFAULT 0,
  descricao TEXT, busca_norm TEXT NOT NULL DEFAULT '', ativo INTEGER NOT NULL DEFAULT 1,
  atualizado_em TEXT NOT NULL DEFAULT '', custo_medio_centavos INTEGER NOT NULL DEFAULT 0
);
INSERT INTO livro_new
  (codigo, titulo, autor, preco_centavos, categoria, estoque, descricao, busca_norm, ativo, atualizado_em, custo_medio_centavos)
  SELECT codigo, titulo, autor, preco_centavos, categoria, estoque, descricao, busca_norm, ativo, atualizado_em, custo_medio_centavos
  FROM livro;

-- 2) cada filha real: nova com livro_id, copiando por JOIN no mapa codigo→id
CREATE TABLE movimento_estoque_new ( id INTEGER PRIMARY KEY AUTOINCREMENT,
  livro_id INTEGER NOT NULL REFERENCES livro(id), tipo TEXT NOT NULL, qtd INTEGER NOT NULL,
  custo_unit_centavos INTEGER, fornecedor TEXT, motivo TEXT, referencia TEXT, criado_em TEXT NOT NULL DEFAULT '');
INSERT INTO movimento_estoque_new (id, livro_id, tipo, qtd, custo_unit_centavos, fornecedor, motivo, referencia, criado_em)
  SELECT m.id, ln.id, m.tipo, m.qtd, m.custo_unit_centavos, m.fornecedor, m.motivo, m.referencia, m.criado_em
  FROM movimento_estoque m JOIN livro_new ln ON ln.codigo = m.livro_codigo;

CREATE TABLE item_contagem_new ( id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER NOT NULL REFERENCES sessao_inventario(id),
  livro_id INTEGER NOT NULL REFERENCES livro(id),
  qtd_contada INTEGER NOT NULL DEFAULT 0, qtd_sistema INTEGER, UNIQUE(sessao_id, livro_id));
INSERT INTO item_contagem_new (id, sessao_id, livro_id, qtd_contada, qtd_sistema)
  SELECT i.id, i.sessao_id, ln.id, i.qtd_contada, i.qtd_sistema
  FROM item_contagem i JOIN livro_new ln ON ln.codigo = i.livro_codigo;

CREATE TABLE item_lancamento_new ( id INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id INTEGER NOT NULL REFERENCES lancamento_entrada(id),
  livro_id INTEGER NOT NULL REFERENCES livro(id),
  qtd INTEGER NOT NULL, custo_unit_centavos INTEGER NOT NULL DEFAULT 0, UNIQUE(lancamento_id, livro_id));
INSERT INTO item_lancamento_new (id, lancamento_id, livro_id, qtd, custo_unit_centavos)
  SELECT il.id, il.lancamento_id, ln.id, il.qtd, il.custo_unit_centavos
  FROM item_lancamento il JOIN livro_new ln ON ln.codigo = il.livro_codigo;

-- 3) VERIFICAÇÃO anti-perda (em Rust): o INNER JOIN descarta apenas ÓRFÃS pré-existentes
--    (FK para livro inexistente — já violavam integridade). Garantir que nenhuma linha VÁLIDA
--    se perca e logar as órfãs removidas:
--    count(livro_new)             == count(livro)
--    count(movimento_estoque_new) == count(movimento_estoque WHERE livro_codigo IN (SELECT codigo FROM livro))
--    count(item_contagem_new)     == count(item_contagem    WHERE livro_codigo IN (SELECT codigo FROM livro))
--    count(item_lancamento_new)   == count(item_lancamento  WHERE livro_codigo IN (SELECT codigo FROM livro))
--    LOG: órfãs removidas por tabela = count(total) - count(válidas)   (base atual: 1 movimento + 1 contagem, livro 'cmmb57324')
--    Se qualquer igualdade falhar → retornar Err → rollback.

-- 4) troca atômica
DROP TABLE movimento_estoque;       ALTER TABLE movimento_estoque_new RENAME TO movimento_estoque;
DROP TABLE item_contagem;           ALTER TABLE item_contagem_new     RENAME TO item_contagem;
DROP TABLE item_lancamento;         ALTER TABLE item_lancamento_new   RENAME TO item_lancamento;
DROP TABLE livro;                   ALTER TABLE livro_new             RENAME TO livro;

-- 5) índices + checagem final
CREATE INDEX IF NOT EXISTS idx_livro_busca   ON livro(busca_norm);
CREATE INDEX IF NOT EXISTS idx_mov_livro      ON movimento_estoque(livro_id, id);
CREATE INDEX IF NOT EXISTS idx_item_lanc      ON item_lancamento(lancamento_id);
PRAGMA foreign_key_check;   -- sem linhas de violação

COMMIT;  -- ou ROLLBACK se a verificação (passo 3) falhar
```

**Notas de implementação**
- A verificação (passo 3) é feita em Rust entre os INSERTs e os DROPs; ao falhar, retornar `Err(DbErr)` para o migrator desfazer a transação (FR-044).
- Ordem dos DROP/RENAME: filhas antes de `livro` para não esbarrar em dependências; com `foreign_keys` OFF durante o rebuild não há bloqueio, mas a ordem mantém clareza.
- **Órfãs pré-existentes**: a base real **tem** linhas filhas apontando para livro removido (hoje: `movimento_estoque` id 470 e `item_contagem` id 109, ambas do código `cmmb57324`). O `INNER JOIN` as descarta de propósito; a verificação compara o `count(novo)` com o `count(válidas)` (linhas cujo `livro_codigo` existe em `livro`), **não** com o total bruto — assim nenhuma linha válida some e as órfãs são removidas e **logadas**. Isto é a limpeza correta de dados pendurados; `PRAGMA foreign_key_check` fica limpo depois.
- `item_pedido` (snapshot) e `pendencia_cadastro` (texto lido) **não** são tocados; podem ter `codigo` sem livro correspondente sem problema.

## Entidades do domínio / aplicação afetadas

- **`domain::livro::Livro`**: remove `codigo_barras`; opcionalmente carrega `id` (ou mantém `codigo` como identidade de domínio e o `id` fica no adapter). Decisão: domínio continua usando `codigo` como identidade lógica; `id` é detalhe de persistência exposto só onde útil (DTO de leitura).
- **`domain::inventario`**: + `ResumoInventario { total, bateram, faltaram, sobraram, soma_diferencas }` + `fn resumir(itens: &[(i64 /*sistema*/, i64 /*contada*/)]) -> ResumoInventario` (pura, com testes).
- **`ports_inventario`**: `SessaoView` + `fechada_em: Option<String>`; novos métodos `sessoes_realizadas()`, `itens_fechada(sessao_id)` (todos os itens do snapshot, incl. iguais), `reabrir_pendencia(id)`.
- **DTO de fronteira** (`LivroDto`): remove `codigoBarras`; pode expor `id`.

## Estados da `PendenciaCadastro`

```text
ativa (resolvida=0)  --"Já resolvido"/"Cadastrar livro"-->  resolvida (resolvida=1)
resolvida (resolvida=1)  --"Reabrir"-->  ativa (resolvida=0)
```
Código lido e quantidade preservados em todos os estados.
