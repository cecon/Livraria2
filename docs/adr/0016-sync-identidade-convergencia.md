# ADR-0016 — Sincronização: identidade estável, deduplicação e convergência idempotente

**Status**: Aceito · **Data**: 2026-07-20

## Contexto
Com a nuvem como hub (ADR-0015) e dois pontos de escrita (PDV e escritório), a sincronização precisa
ser **idempotente** — rodar N vezes = rodar 1 vez, sem duplicar nem perder — e **convergente** — após
ambos sincronizarem, o estado é idêntico dos dois lados. Dois obstáculos concretos no schema atual:
`movimento_estoque.id` é **autoincrement** (colidiria entre PDV e nuvem) e `livro.custo_medio_centavos`
é um **campo cacheado dependente de ordem** (m004). Há ainda **órfãs históricas** no SQLite (FK não
enforced em runtime — memória do projeto), e o Postgres **vai** enforçar FK.

## Decisão (specs/007-sincronizacao-nuvem/research.md D4–D6, D8, D11, D13; data-model.md)
- **Identidade estável `sync_uid` (UUID v4)**, imutável, gerada na origem, em todas as tabelas
  sincronizáveis. A sincronização é **upsert por `sync_uid`** (`Prefer: resolution=merge-duplicates`),
  o que dá idempotência e retomada. O `id` autoincrement local continua só para FKs internas. O
  `sync_uid` **nunca** é reatribuído — nem em rebuild (o rebuild deve preservá-lo; memória
  `sqlite-fks-nao-enforced`).
- **Deduplicação por chave natural** para entidades que os dois lados podem criar independentemente:
  `livro` por **código de barras** (`codigo`, ADR-0012) e `fornecedor` por **nome/documento**. Índice
  único garante que a merge **una** o registro existente (update/LWW) em vez de criar duplicata.
- **Estoque = eventos crus append-only**: sincronizam-se apenas os movimentos (`tipo, qtd,
  custo_unit, livro_codigo, criado_em, sync_uid`). **Saldo e `custo_medio` NUNCA são sincronizados como
  número** — são **recomputados por fold determinístico do ledger** (ADR-0009) após cada merge,
  ordenado por `criado_em` (tempo comparável entre origens), não por `id` local. Como PDV (saídas) e
  escritório (entradas) escrevem em origens disjuntas e movimentos são imutáveis, a união é
  **conflict-free** e independente de ordem para o saldo (soma).
- **Recursos mutáveis (livro, fornecedor): last-write-wins** por `atualizado_em` carimbado com **tempo
  do servidor** (não relógio do cliente). Só sobrescreve se `atualizado_em` recebido ≥ o local.
- **Deleções por soft delete** (`excluido_em`): propagam como update idempotente; movimentos não se
  apagam (append-only).
- **Watermark/cursor** por **tempo do servidor** (`sincronizado_em DEFAULT now()` na nuvem) — cursor de
  pull; no PDV, `sincronizado_em IS NULL` marca pendências de push. O watermark é **otimização**, não
  correção: reenviar tudo continua idempotente pelo upsert.
- **Ordem e órfãs**: push/seed ordenados **pais→filhas** (livro → movimento/pedido → itens);
  registros **órfãos** (ex.: movimento com `livro_codigo` inexistente) são **isolados e reportados**,
  sem abortar o lote (FR-012). O **seed inicial** reusa o push de pendentes (idempotente).

## Consequências
- **Positivas**: sincronização à prova de re-execução e de interrupção; convergência de estoque
  garantida (saldo bate dos dois lados); sem resolução de conflito no recurso mais quente (estoque);
  dedup evita livros/fornecedores duplicados; derivados sempre corretos por recomputação.
- **Custos/risco**: `m008` adiciona colunas e backfill de `sync_uid` em várias tabelas (aditivo,
  idempotente); a recomputação do `custo_medio` precisa rodar após cada merge nos livros afetados;
  exige carimbar `atualizado_em`/cursor com tempo do servidor.
- **Alternativas rejeitadas**: sincronizar `custo_medio`/saldo como número (diverge com intercalação);
  chave composta `(origem, id_local)` (atrito nas FKs); reusar `id` local (colisão garantida); só
  `sync_uid` sem dedup natural (duplicaria livro/fornecedor); relógio do cliente como referência
  (drift); abortar o lote numa órfã (trava o sync).
