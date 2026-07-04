# Data Model — Destinação de estoque para doações (006)

Esquema SQLite (dinheiro em centavos — ADR-0005; quantidades em inteiros). Nomes seguem o
padrão das tabelas existentes. Referências: [research.md](research.md).

Regra de ordem: **venda** consome carimbos na ordem do cadastro (Loja sempre primeiro) e por
último o saldo livre; **perdas/ajustes negativos/estornos de entrada** fazem o inverso (livre
primeiro, depois carimbos na ordem), protegendo o compromisso com o doador.

Sem nota de doação (Clarifications 2026-07-04): a entrada é o lançamento normal existente —
**nenhuma alteração em `lancamento_entrada`/`item_lancamento`**. Carimbos nascem apenas por
transferência.

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

### `destinacao_saldo` — carimbos por livro

```sql
CREATE TABLE IF NOT EXISTS destinacao_saldo (
    livro_id      INTEGER NOT NULL REFERENCES livro(id),
    destinacao_id INTEGER NOT NULL REFERENCES destinacao(id),
    qtd           INTEGER NOT NULL DEFAULT 0,   -- sempre ≥ 0
    PRIMARY KEY (livro_id, destinacao_id)
);
```

- **Qualquer destinação pode ter linha, inclusive a Loja** (lotes doados "para cobrir custos"
  vendem primeiro). O saldo livre é o resíduo (`estoque − Σ carimbos`), nunca armazenado, e
  pertence à Loja no relatório.
- Invariante (por livro): `Σ qtd ≤ livro.estoque`. Mantido por transação em todos os fluxos.
- Linhas com `qtd = 0` podem ser removidas (upsert com delete) — mantém a tabela enxuta.

### `transferencia_destinacao` — destinar/remanejar estoque (US1)

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
- Guards: `de ≠ para`; origem com saldo suficiente (livre = `estoque − Σ carimbos`); destino
  deve estar **ativo** (origem pode estar inativa — drenar saldo é permitido).
- É a trilha de auditoria dos carimbos ("como Missões chegou a 210?") — único mecanismo de
  criação.

### `alocacao_venda` — consumo por item de venda

```sql
CREATE TABLE IF NOT EXISTS alocacao_venda (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_numero  INTEGER NOT NULL REFERENCES pedido(numero),
    item_id        INTEGER NOT NULL REFERENCES item_pedido(id),
    destinacao_id  INTEGER NOT NULL REFERENCES destinacao(id),
    qtd            INTEGER NOT NULL,            -- > 0
    valor_centavos INTEGER NOT NULL             -- qtd × preço efetivo do item
);
CREATE INDEX IF NOT EXISTS idx_aloc_pedido ON alocacao_venda(pedido_numero);
```

- Uma linha para **cada consumo de carimbo** (inclusive carimbo Loja — necessário para o
  estorno devolver ao carimbo certo). Consumo do saldo **livre** não gera linha: a parte da
  Loja no relatório é derivada (total − Σ linhas de destinações ≠ Loja).
- Estorno de venda (janela de 5 dias — FR-011): devolve `qtd` a `destinacao_saldo` por linha;
  as linhas **permanecem** (o relatório exclui via `pedido.cancelado = 0` — efeito retroativo).

## Fluxos de escrita (transações)

| Fluxo | Física (razão/estoque) | Carimbos (`destinacao_saldo`) | Alocações |
|---|---|---|---|
| Transferir destinação (US1) | **nada** (físico intocado) | `−qtd` origem / `+qtd` destino | registro em `transferencia_destinacao` |
| Registrar venda | `saida_venda` (atual) | consome **carimbos em ordem (Loja 1º) → livre** | grava linha por carimbo consumido |
| Cancelar venda (≤ 5 dias) | `estorno` físico (atual) | devolve pelas alocações | mantém linhas (pedido cancelado) |
| Ajuste negativo / contagem p/ baixo | `ajuste`/`contagem` (atual) | consome **livre → carimbos em ordem** (inverso da venda) | — |
| Cancelar lançamento de entrada | `estorno` físico (atual) | consome **livre → carimbos** (regra de perda) | — |
| Ajuste positivo / contagem p/ cima / entrada | atual | nada (entra como livre = Loja) | — |

Regra de consumo (helper único `consumir_carimbos` — D4), parametrizada pelo fluxo:

- **Venda**: percorre os carimbos na ordem `destinacao.ordem` (Loja = 0, sempre primeira),
  decrementando; o excedente sai do `livre = estoque − Σ carimbos`. Retorna
  `[(destinacao_id | livre, qtd_consumida)]` para gravar as alocações (linhas só para carimbos).
- **Perda/ajuste/estorno de entrada**: consome o `livre` primeiro; o excedente percorre os
  carimbos na mesma ordem do cadastro. Sem alocação (não há valor de venda).

## Alterações em fluxos existentes (sem mudança de schema)

- **Cancelamento de venda** (comando existente `excluir_pedido`): ganha o guard dos **5 dias
  corridos** (FR-011) — comparação da data da venda com a data atual, bloqueio com mensagem
  clara (erro `venda_antiga`). Vale para toda venda.

## Domínio puro (`domain/destinacao.rs` e `domain/alocacao.rs`)

- **`destinacao.rs`**: `Destinacao { id, nome, de_sistema, ativa, ordem }` + validações: nome
  não-vazio, `pode_excluir(em_uso)`, `pode_desativar`, `pode_reordenar` (Loja: nunca).
- **`alocacao.rs`** (arquivo próprio p/ o limite de 300 linhas com testes inline):
  - `alocar_venda(&[(id, saldo)], livre, qtd) -> Vec<(Option<id>, qtd)>` — carimbos em ordem,
    depois livre (`None`); erro se `qtd > livre + Σ saldos` (nunca deve ocorrer: físico barra).
  - `alocar_perda(livre, &[(id, saldo)], qtd) -> Vec<(Option<id>, qtd)>` — livre primeiro,
    depois carimbos em ordem (inverso da venda).
  - `validar_transferencia(origem_saldo, qtd)`; inversos triviais para estorno.
- **`pedido.rs`** (alterado): `pode_cancelar_venda(data_venda, hoje)` (≤ 5 dias corridos) —
  regra do guard do comando existente `excluir_pedido`.

## Consultas de leitura principais

- **Relatório por destinação (período)**: destinações ≠ Loja pela soma de `alocacao_venda`
  por `destinacao_id`; **Loja = total vendido − Σ dessas somas** (cobre livre + carimbo Loja).
  Junta `pedido.data BETWEEN ? AND ?` e `cancelado = 0`.
- **Posição atual (FR-018)**: `SELECT destinacao_id, SUM(qtd) FROM destinacao_saldo GROUP BY 1`
  (+ nomes), exibida na tela do relatório, independente do período.
- **Detalhe da venda**: itens + alocações por `pedido_numero`; a parte do livre é derivada por
  item (qtd − Σ alocações) e exibida consolidada como Loja.
- **Saldos de um livro** (tela de transferência): linhas de `destinacao_saldo` + livre.
- **`em_uso(destinacao_id)`**: existe em `destinacao_saldo` (qtd > 0) OU `alocacao_venda` OU
  `transferencia_destinacao` (origem/destino) — guard de exclusão (FR-004/FR-007).
- **Histórico de transferências de um livro**: `transferencia_destinacao` por `livro_id`,
  com nomes das destinações (NULL = "Livre").
