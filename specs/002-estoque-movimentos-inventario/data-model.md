# Data Model — Movimentação de Estoque & Inventário (Livraria 2)

Estende o modelo da feature 001. Domínio Rust puro + esquema SQLite (SeaORM). **Dinheiro = centavos i64.**
Datas/horas em ISO (`yyyy-mm-dd` ou `yyyy-mm-ddTHH:MM:SS`).

## Tipos de domínio (novos)

### TipoMovimento (enum)
`SaldoInicial · Entrada · SaidaVenda · Ajuste · Contagem`
Persistido como texto: `saldo_inicial | entrada | saida_venda | ajuste | contagem`.

### ModoInventario (enum)
`Parcial · Total` → texto `parcial | total`.

### StatusSessao (enum)
`Aberta · Fechada · Cancelada` → texto `aberta | fechada | cancelada`.

## Entidades

### Livro (ALTERADO — colunas novas)
| Campo | Tipo | Regras |
|---|---|---|
| codigo | String (PK) | identidade interna (inalterada) |
| codigo_barras | Option<String> | **NOVO** — EAN/ISBN opcional; chave de busca na bipagem; index |
| custo_medio_centavos | i64 | **NOVO** — ≥ 0; recalculado só em entrada; default 0 |
| *(demais campos da 001 inalterados: titulo, autor, preco, categoria, estoque, descricao, busca_norm, ativo)* | | |

**Invariante (SC-001)**: `estoque == Σ qtd dos movimentos do livro`.

### MovimentoEstoque (NOVO — ledger, append-only)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| livro_codigo | String | FK → livro.codigo |
| tipo | TipoMovimento | ver enum |
| qtd | i64 | **com sinal**: + (`saldo_inicial`,`entrada`,`ajuste`+,`contagem`+); − (`saida_venda`,`ajuste`−,`contagem`−) |
| custo_unit_centavos | Option<i64> | só em `entrada`; ≥ 0 |
| fornecedor | Option<String> | só em `entrada` |
| motivo | Option<String> | obrigatório em `ajuste`; descreve origem em outros |
| referencia | Option<String> | nº do pedido (`saida_venda`) ou id da sessão (`contagem`) |
| criado_em | String (ISO datetime) | |

Imutável após criação (FR-005): correções via novos movimentos, nunca edição/exclusão.
Index: `idx_mov_livro (livro_codigo, id)`.

### SessaoInventario (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| modo | ModoInventario | `parcial`/`total` |
| rotulo | Option<String> | ex.: "Gaveta A" (uso típico em parcial) |
| status | StatusSessao | `aberta`→`fechada`/`cancelada` |
| aberta_em | String (ISO datetime) | |
| fechada_em | Option<String> | preenchido no fechamento/cancelamento |

Regra: no máximo **uma** sessão `aberta` por vez (mono-estação).

### ItemContagem (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| sessao_id | i64 | FK → sessao_inventario.id |
| livro_codigo | String | FK → livro.codigo |
| qtd_contada | i64 | ≥ 0; cada bipagem soma +1; editável manualmente |
| qtd_sistema | Option<i64> | snapshot capturado **no fechamento** |
| **UNIQUE** (sessao_id, livro_codigo) | | uma linha por livro por sessão |

`diferenca = qtd_contada − qtd_sistema` (calculada no fechamento).

### PendenciaCadastro (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| sessao_id | Option<i64> | FK → sessao_inventario.id (origem) |
| codigo_lido | String | código bipado sem livro correspondente |
| qtd | i64 | ≥ 1; soma a cada nova leitura do mesmo código |
| resolvida | bool (int 0/1) | vira 1 ao cadastrar o livro |
| criado_em | String (ISO datetime) | |

## Regras de domínio puras (testáveis sem UI/banco)

- **`custo_medio_apos_entrada(estoque, medio, qtd, custo_unit) -> i64`**:
  `round_half_up((estoque*medio + qtd*custo_unit) / (estoque + qtd))`. Se `estoque+qtd == 0` → 0.
- **`derivar_custos(total: Option<i64>, unit: Option<i64>, qtd) -> (unit, total)`**:
  total informado → `unit = round_half_up(total/qtd)`; unit informado → `total = unit*qtd`.
- **`aplicar_ajuste(estoque, delta) -> Result<i64, ErroDominio>`**: `r = estoque+delta`; se `r < 0` →
  `Err(EstoqueNegativo)`; senão `Ok(r)`.
- **`diferenca_contagem(sistema, contado) -> i64`**: `contado − sistema` (pode ser ±). Estoque final = contado.
- **Modo total no fechamento**: para cada livro **ativo** sem `item_contagem` na sessão, tratar contagem = 0
  (gera ajuste para zerar), apenas após confirmação. Modo parcial: ignora livros não contados.

## Esquema SQLite (migration `m_estoque`, idempotente)

```sql
-- colunas novas no acervo (migration rastreada roda 1×)
ALTER TABLE livro ADD COLUMN codigo_barras TEXT;
ALTER TABLE livro ADD COLUMN custo_medio_centavos INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_livro_codbarras ON livro(codigo_barras);

CREATE TABLE IF NOT EXISTS movimento_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
    tipo TEXT NOT NULL,
    qtd INTEGER NOT NULL,
    custo_unit_centavos INTEGER,
    fornecedor TEXT,
    motivo TEXT,
    referencia TEXT,
    criado_em TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mov_livro ON movimento_estoque(livro_codigo, id);

CREATE TABLE IF NOT EXISTS sessao_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modo TEXT NOT NULL,
    rotulo TEXT,
    status TEXT NOT NULL DEFAULT 'aberta',
    aberta_em TEXT NOT NULL DEFAULT '',
    fechada_em TEXT
);

CREATE TABLE IF NOT EXISTS item_contagem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessao_id INTEGER NOT NULL REFERENCES sessao_inventario(id),
    livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
    qtd_contada INTEGER NOT NULL DEFAULT 0,
    qtd_sistema INTEGER,
    UNIQUE(sessao_id, livro_codigo)
);

CREATE TABLE IF NOT EXISTS pendencia_cadastro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessao_id INTEGER REFERENCES sessao_inventario(id),
    codigo_lido TEXT NOT NULL,
    qtd INTEGER NOT NULL DEFAULT 1,
    resolvida INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT ''
);
```

> `ALTER TABLE ADD COLUMN` não é `IF NOT EXISTS` no SQLite; a idempotência vem do **migrator** (a migration
> `m_estoque` é registrada em `seaql_migrations` e roda uma única vez). O backfill de `saldo_inicial` é um
> passo de runtime idempotente (só para livros sem movimento), fora da migration.

## Backfill de saldo inicial (runtime, idempotente)

No boot (após migrar), `gerar_saldos_iniciais()`:
1. seleciona livros **sem nenhum** movimento;
2. para cada, insere `movimento_estoque(tipo='saldo_inicial', qtd = livro.estoque, criado_em = agora)`.
Re-execução não cria duplicatas (a condição "sem movimento" deixa de valer após a 1ª).
