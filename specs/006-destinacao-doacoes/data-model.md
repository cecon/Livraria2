# Data Model — Destinação de estoque para doações (006)

Esquema SQLite (dinheiro em centavos — ADR-0005; quantidades em inteiros). Nomes seguem o
padrão das tabelas existentes. Referências: [research.md](research.md) (D1–D10).

## Tabelas novas

### `destinacao` — cadastro (US3)

```sql
CREATE TABLE IF NOT EXISTS destinacao (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    nome_norm  TEXT NOT NULL,              -- normalizado (caixa/acentos/trim), unicidade entre ativas
    de_sistema INTEGER NOT NULL DEFAULT 0, -- 1 = "Custos" (não exclui/desativa/reordena; sempre 1ª)
    ativa      INTEGER NOT NULL DEFAULT 1,
    ordem      INTEGER NOT NULL DEFAULT 0  -- ordem de exibição E de baixa ("Custos" fixa em 0)
);
```

- Seed (m007): `Custos` com `de_sistema=1, ordem=0` via `INSERT … WHERE NOT EXISTS (de_sistema=1)`.
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

- Só destinações **especiais** têm linhas (Custos = resíduo, nunca aparece aqui).
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

- Só destinações especiais; a parte de Custos de um item é `item.qtd − Σ alocações` (derivada).
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

- Só destinações especiais (parte de Custos do item = `item.qtd − Σ rateios`, pode ser 0).
- Validação na finalização: `Σ rateios ≤ qtd do item` (o resto é Custos); a UI exige a conta
  exata exibindo o resíduo como "Custos" explicitamente.

### `transferencia_destinacao` — destinar/remanejar estoque existente (US4)

```sql
CREATE TABLE IF NOT EXISTS transferencia_destinacao (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    livro_id           INTEGER NOT NULL REFERENCES livro(id),
    de_destinacao_id   INTEGER REFERENCES destinacao(id),   -- NULL = Livre (Custos)
    para_destinacao_id INTEGER REFERENCES destinacao(id),   -- NULL = Livre (Custos)
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
| Registrar venda | `saida_venda` (atual) | consome livre→carimbos em ordem | grava linhas especiais |
| Cancelar venda | `estorno` físico (atual) | devolve pelas alocações | mantém linhas (pedido cancelado) |
| Ajuste negativo / contagem p/ baixo | `ajuste`/`contagem` (atual) | consome livre→carimbos em ordem | — |
| Ajuste positivo / contagem p/ cima | idem (atual) | nada (entra como livre = Custos) | — |
| Transferir destinação (US4) | **nada** (físico intocado) | `−qtd` origem / `+qtd` destino | registro em `transferencia_destinacao` |

Regra de consumo (helper único `consumir_carimbos` — D4): dado `qtd` a baixar de um livro,
consome primeiro `livre = estoque − Σ carimbos`; o excedente percorre os carimbos na ordem
`destinacao.ordem` (Custos não está na tabela, então a ordem dos especiais basta), decrementando
e retornando a lista `[(destinacao_id, qtd_consumida)]` para quem precisar gravar alocação.

## Domínio puro (`domain/destinacao.rs`)

- `Destinacao { id, nome, de_sistema, ativa, ordem }` + validações: nome não-vazio,
  `pode_excluir(em_uso)`, `pode_desativar`, `pode_reordenar` (Custos: nunca).
- `ratear_percentual(qtd, &[(id, pct)]) -> Vec<(id, qtd)>` — floor + sobra à primeira (D8).
- `validar_rateio_item(qtd_item, &[(id, qtd)]) -> Result<()>` — qtds > 0, ids distintos, Σ ≤ qtd.
- `alocar_saida(livre, &[(id, saldo)], qtd) -> Vec<(Option<id>, qtd)>` — `None` = livre/Custos;
  erro se `qtd > livre + Σ saldos` (nunca deve ocorrer: estoque físico já barra).
- Inversos triviais para estorno (devolver por lista de alocações).

## Consultas de leitura principais

- **Relatório por destinação (período)**: total vendido no período (pedidos não cancelados)
  − Σ `alocacao_venda.valor_centavos` do período = Custos; especiais direto da soma por
  `destinacao_id`. Junta `pedido.data BETWEEN ? AND ?` e `cancelado = 0`.
- **Detalhe da venda**: itens + alocações por `pedido_numero` (parte Custos derivada por item).
- **Saldos de um livro** (para tela de rateio e depuração): linhas de `destinacao_saldo` + livre.
- **`em_uso(destinacao_id)`**: existe em `destinacao_saldo` (qtd > 0) OU `alocacao_venda` OU
  `item_lancamento_destinacao` OU `transferencia_destinacao` (origem/destino) — guard de
  exclusão (FR-004/FR-015b).
- **Histórico de transferências de um livro**: `transferencia_destinacao` por `livro_id`,
  com nomes das destinações (NULL = "Livre").
