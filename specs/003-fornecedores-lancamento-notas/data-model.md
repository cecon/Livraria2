# Data Model — Fornecedores & Lançamento de Notas

Estende as features 001/002. Domínio Rust puro + esquema SQLite (SeaORM). **Dinheiro = centavos i64.**
Datas/horas em ISO. Reusa `livro` e `movimento_estoque` (002).

## Tipos de domínio (novos)

### StatusLancamento (enum)
`Rascunho · Finalizada` → texto `rascunho | finalizada`.

## Entidades

### Fornecedor (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| nome | String | obrigatório |
| nome_norm | String | `normalize(nome)` — **UNIQUE** (sem acento/caixa), evita duplicidade (FR-004) |
| documento | Option<String> | CNPJ/CPF opcional (sem validação fiscal) |
| telefone | Option<String> | |
| email | Option<String> | |
| observacoes | Option<String> | |
| ativo | bool | soft-delete (FR-002); inativo não aparece para seleção |

### LancamentoEntrada / Nota (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| fornecedor_id | i64 | FK → fornecedor.id (obrigatório para finalizar) |
| numero | Option<String> | número da NF, opcional (texto livre) |
| data | String (ISO) | automática (criação) |
| status | StatusLancamento | `rascunho` → `finalizada` |
| finalizada_em | Option<String> | preenchido ao dar entrada |

Total da nota = Σ (`custo_unit_centavos × qtd`) dos itens.

### ItemLancamento (NOVO)
| Campo | Tipo | Regras |
|---|---|---|
| id | i64 (PK, autoinc) | |
| lancamento_id | i64 | FK → lancamento_entrada.id |
| livro_codigo | String | FK → livro.codigo |
| qtd | i64 | > 0 |
| custo_unit_centavos | i64 | ≥ 0 |
| **UNIQUE** (lancamento_id, livro_codigo) | | um livro por linha; adicionar de novo soma a qtd |

### MovimentoEstoque (existente, 002)
A finalização gera um movimento `entrada` por item: `tipo='entrada'`, `qtd`, `custo_unit_centavos`,
`fornecedor` = nome do fornecedor, `referencia` = id da nota, atualizando `livro.estoque` e `custo_medio`.

## Regras de domínio puras (testáveis sem UI/banco)

- **`Fornecedor::validar(nome)`** → erro se nome vazio.
- **`total_item(qtd, custo_unit) -> i64`** e **`total_nota(itens) -> i64`**.
- **`derivar_custos(total, unit, qtd)`** (reuso de `domain::estoque`, 002) ao adicionar item.
- **`pode_finalizar(nota) -> Result<(), ErroDominio>`**: exige `fornecedor` definido e ≥ 1 item; nota já
  `finalizada` não pode finalizar de novo.
- **`custo_medio_apos_entrada(...)`** (reuso 002) aplicado por item na finalização.

## Esquema SQLite (migration `m_fornecedores`, idempotente)

```sql
CREATE TABLE IF NOT EXISTS fornecedor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    nome_norm TEXT NOT NULL,
    documento TEXT,
    telefone TEXT,
    email TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedor_norm ON fornecedor(nome_norm);

CREATE TABLE IF NOT EXISTS lancamento_entrada (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fornecedor_id INTEGER REFERENCES fornecedor(id),
    numero TEXT,
    data TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'rascunho',
    finalizada_em TEXT
);

CREATE TABLE IF NOT EXISTS item_lancamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lancamento_id INTEGER NOT NULL REFERENCES lancamento_entrada(id),
    livro_codigo TEXT NOT NULL REFERENCES livro(codigo),
    qtd INTEGER NOT NULL,
    custo_unit_centavos INTEGER NOT NULL DEFAULT 0,
    UNIQUE(lancamento_id, livro_codigo)
);
CREATE INDEX IF NOT EXISTS idx_item_lanc ON item_lancamento(lancamento_id);
```

> Idempotência via migrator (migration registrada roda 1×). Tabelas com `IF NOT EXISTS`.

## Seed de fornecedores (runtime, idempotente)

No boot (após migrar), `semear_fornecedores()`:
1. seleciona `fornecedor` distinto, não vazio, de `movimento_estoque`;
2. para cada, insere em `fornecedor` (nome + nome_norm) **se não existir** (`nome_norm`).
Re-execução não duplica (UNIQUE em `nome_norm`).

## Transições de estado da nota

`rascunho` → (dar entrada) → `finalizada` (imutável). `rascunho` → (excluir) → removida (sem efeito no
estoque). `finalizada` não volta para `rascunho` nem se edita (correções via Ajuste/Inventário, 002).
