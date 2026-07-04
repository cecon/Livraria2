# Data Model — Destinação de estoque para doações (006)

Esquema SQLite (dinheiro em centavos — ADR-0005; quantidades em inteiros). Nomes seguem o
padrão das tabelas existentes. Referências: [research.md](research.md) (D1–D11).

Regra de ordem (revisada em 2026-07-04): **venda** consome carimbos na ordem do cadastro
(Loja sempre primeiro) e por último o saldo livre; **perdas** fazem o inverso (livre primeiro,
depois carimbos na ordem), protegendo o compromisso com o doador.

## Tabelas novas

### `destinacao` — cadastro (US3)

```sql
CREATE TABLE IF NOT EXISTS destinacao (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    nome_norm  TEXT NOT NULL,              -- normalizado (caixa/acentos/trim), unicidade entre ativas
    de_sistema INTEGER NOT NULL DEFAULT 0, -- 1 = "Loja" (não exclui/desativa/reordena; sempre 1ª)
    ativa      INTEGER NOT NULL DEFAULT 1,
    ordem      INTEGER NOT NULL DEFAULT 0  -- ordem de exibição E de baixa dos carimbos ("Loja" fixa em 0)
);
```

- Seed (m007): `Loja` com `de_sistema=1, ordem=0` via `INSERT … WHERE NOT EXISTS (de_sistema=1)`.
- Unicidade de `nome_norm` **entre ativas** verificada na aplicação (mesma regra da 005 —
  reativação conflitante também bloqueia). Sem índice UNIQUE (inativas podem repetir nome).

### `destinacao_saldo` — carimbos por livro (D1/D2)

```sql
CREATE TABLE IF NOT EXISTS destinacao_saldo (
    livro_id      INTEGER NOT NULL REFERENCES livro(id),
    destinacao_id INTEGER NOT NULL REFERENCES destinacao(id),
    qtd           INTEGER NOT NULL DEFAULT 0,   -- sempre ≥ 0
    PRIMARY KEY (livro_id, destinacao_id)
);
```

- **Qualquer destinação pode ter linha, inclusive a Loja** (lotes doados "para cobrir custos"
  vendem primeiro). O saldo livre continua sendo o resíduo (`estoque − Σ carimbos`) e pertence
  à Loja no relatório.
- Invariante (por livro): `Σ qtd ≤ livro.estoque`. Mantido por transação em todos os fluxos.
- Linhas com `qtd = 0` podem ser removidas (upsert com delete) — mantém a tabela enxuta.

### `alocacao_venda` — consumo por item de venda (D3)

```sql
CREATE TABLE IF NOT EXISTS alocacao_venda (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_numero  INTEGER NOT NULL REFERENCES pedido(numero),
    item_id        INTEGER NOT NULL REFERENCES item_pedido(id),
    destinacao_id  INTEGER NOT NULL REFERENCES destinacao(id),
    qtd            INTEGER NOT NULL,            -- > 0
    valor_centavos INTEGER NOT NULL             -- qtd × preço efetivo do item (D10)
);
CREATE INDEX IF NOT EXISTS idx_aloc_pedido ON alocacao_venda(pedido_numero);
```

- Uma linha para **cada consumo de carimbo** (inclusive carimbo Loja — necessário para o
  estorno devolver ao carimbo certo). Consumo do saldo **livre** não gera linha: a parte da
  Loja no relatório é derivada (total − Σ linhas de destinações ≠ Loja).
- Estorno de venda: devolve `qtd` a `destinacao_saldo` por linha; as linhas **permanecem**
  (o relatório exclui via `pedido.cancelado = 0`).

### `item_lancamento_destinacao` — rateio do item da nota de doação (US1)

```sql
CREATE TABLE IF NOT EXISTS item_lancamento_destinacao (
    item_lancamento_id INTEGER NOT NULL REFERENCES item_lancamento(id),
    destinacao_id      INTEGER NOT NULL REFERENCES destinacao(id),
    qtd                INTEGER NOT NULL,        -- > 0
    PRIMARY KEY (item_lancamento_id, destinacao_id)
);
```

- Inclui a parte da **Loja** (toda a doação ganha carimbo — FR-009).
- Validação na finalização: `Σ rateios = qtd do item` (a UI preenche pelo padrão da nota e
  aponta a diferença quando a conta não fecha).

### `transferencia_destinacao` — destinar/remanejar estoque existente (US4)

```sql
CREATE TABLE IF NOT EXISTS transferencia_destinacao (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    livro_id           INTEGER NOT NULL REFERENCES livro(id),
    de_destinacao_id   INTEGER REFERENCES destinacao(id),   -- NULL = saldo livre
    para_destinacao_id INTEGER REFERENCES destinacao(id),   -- NULL = saldo livre
    qtd                INTEGER NOT NULL,                    -- > 0
    motivo             TEXT,
    criado_em          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_transf_livro ON transferencia_destinacao(livro_id, id);
```

- Não altera estoque físico nem gera movimento no razão — só move carimbo (transação:
  registro + upsert/decremento em `destinacao_saldo`).
- Guards: `de ≠ para`; origem com saldo suficiente (Livre = `estoque − Σ carimbos`); destino
  especial deve estar **ativo** (origem pode estar inativa — drenar saldo é permitido).
- É a trilha de auditoria de carimbos criados fora de nota ("como Missões chegou a 210?").

## Alterações em tabelas existentes

### `lancamento_entrada` (ALTERs tolerantes — m007)

```sql
ALTER TABLE lancamento_entrada ADD COLUMN tipo TEXT NOT NULL DEFAULT 'compra';  -- 'compra' | 'doacao'
ALTER TABLE lancamento_entrada ADD COLUMN doador TEXT;                          -- texto livre, opcional
ALTER TABLE lancamento_entrada ADD COLUMN padrao_json TEXT;                     -- prefill do rateio (D7)
```

- Nota `doacao`: `fornecedor_id` fica NULL; itens têm `custo_unit_centavos = 0` (D6).
- Notas existentes: `tipo='compra'` pelo DEFAULT — comportamento intocado.

## Fluxos de escrita (transações)

| Fluxo | Física (razão/estoque) | Carimbos (`destinacao_saldo`) | Alocações |
|---|---|---|---|
| Finalizar doação | `entrada` custo 0 por item (helper atual) | `+qtd` por rateio do item | — |
| Cancelar doação | `estorno` físico (atual) — guard de estoque | `−qtd` por rateio; **guard**: saldo ≥ rateio (D5) | — |
| Registrar venda | `saida_venda` (atual) | consome **carimbos em ordem (Loja 1º) → livre** | grava linha por carimbo consumido |
| Cancelar venda | `estorno` físico (atual) | devolve pelas alocações | mantém linhas (pedido cancelado) |
| Ajuste negativo / contagem p/ baixo | `ajuste`/`contagem` (atual) | consome **livre → carimbos em ordem** (inverso da venda) | — |
| Ajuste positivo / contagem p/ cima | idem (atual) | nada (entra como livre = Loja) | — |
| Transferir destinação (US4) | **nada** (físico intocado) | `−qtd` origem / `+qtd` destino | registro em `transferencia_destinacao` |

Regra de consumo (helper único `consumir_carimbos` — D4), parametrizada pelo fluxo:

- **Venda**: percorre os carimbos na ordem `destinacao.ordem` (Loja = 0, sempre primeira),
  decrementando; o excedente sai do `livre = estoque − Σ carimbos`. Retorna
  `[(destinacao_id | livre, qtd_consumida)]` para gravar as alocações (linhas só para carimbos).
- **Perda/ajuste**: consome o `livre` primeiro; o excedente percorre os carimbos na mesma
  ordem do cadastro. Sem alocação (não há valor de venda).

## Domínio puro (`domain/destinacao.rs`)

- `Destinacao { id, nome, de_sistema, ativa, ordem }` + validações: nome não-vazio,
  `pode_excluir(em_uso)`, `pode_desativar`, `pode_reordenar` (Loja: nunca).
- `ratear_percentual(qtd, &[(id, pct)]) -> Vec<(id, qtd)>` — floor + sobra à primeira (D8).
- `validar_rateio_item(qtd_item, &[(id, qtd)]) -> Result<()>` — qtds > 0, ids distintos, Σ = qtd.
- `alocar_venda(&[(id, saldo)], livre, qtd) -> Vec<(Option<id>, qtd)>` — carimbos em ordem,
  depois livre (`None`); erro se `qtd > livre + Σ saldos` (nunca deve ocorrer: físico barra).
- `alocar_perda(livre, &[(id, saldo)], qtd) -> Vec<(Option<id>, qtd)>` — livre primeiro,
  depois carimbos em ordem (inverso da venda).
- `validar_transferencia(origem_saldo, qtd)` e inversos triviais para estorno.

## Consultas de leitura principais

- **Relatório por destinação (período)**: destinações ≠ Loja pela soma de `alocacao_venda`
  por `destinacao_id`; **Loja = total vendido − Σ dessas somas** (cobre livre + carimbo Loja).
  Junta `pedido.data BETWEEN ? AND ?` e `cancelado = 0`.
- **Detalhe da venda**: itens + alocações por `pedido_numero`; a parte do livre é derivada por
  item (qtd − Σ alocações) e exibida consolidada como Loja.
- **Saldos de um livro** (para tela de rateio e depuração): linhas de `destinacao_saldo` + livre.
- **`em_uso(destinacao_id)`**: existe em `destinacao_saldo` (qtd > 0) OU `alocacao_venda` OU
  `item_lancamento_destinacao` OU `transferencia_destinacao` (origem/destino) — guard de
  exclusão (FR-004/FR-015b).
- **Histórico de transferências de um livro**: `transferencia_destinacao` por `livro_id`,
  com nomes das destinações (NULL = "Livre").
