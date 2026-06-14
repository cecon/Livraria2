# Data Model — Sistema de Estoque & Vendas (Livraria 2)

Modelo de domínio (Rust puro) e esquema de persistência (SQLite via SeaORM). Dinheiro = **centavos i64**.

## Tipos de domínio

### Categoria (enum fixo 0–6)
`NaoCategorizado=0 · Biblias=1 · Infantil=2 · Familia=3 · Devocional=4 · EstudoTeologia=5 · Ficcao=6`
Imutável (Princípio VI). Persistido como inteiro.

### FormaPagamento (enum)
`Cartao · Dinheiro · Pix · Ministerio · ValePresente` — ordem e rótulos preservados (FR-013).

### Turno (enum)
`Manha · Tarde` — derivado do horário de conclusão (corte ~13h).

### Livro
| Campo | Tipo | Regras |
|---|---|---|
| codigo | String (EAN-13) | **PK**, identidade estável (chave de upsert) |
| titulo | String | obrigatório |
| autor | Option<String> | |
| preco_centavos | i64 | ≥ 0 |
| categoria | Categoria | default `NaoCategorizado` |
| estoque | i64 | ≥ 0 (piso 0; nunca negativo) |
| descricao | Option<String> | |
| busca_norm | String (derivado) | `normalize(titulo + ' ' + autor)` sem acento/caixa (D9) |

**Selo de estoque** (regra de domínio): `estoque<=0 → Esgotado`; `<=3 → Baixo`; senão `Normal`.

### Pedido
| Campo | Tipo | Regras |
|---|---|---|
| numero | i64 | **PK**, sequencial = MAX(numero)+1; contínuo entre execuções |
| cliente | String | default "CLIENTE" |
| turno | Turno | derivado do horário |
| data | String ISO (yyyy-mm-dd) | |
| total_centavos | i64 | = Σ itens |
| val_cartao / val_dinheiro / val_pix / val_ministerio / val_vale | i64 | centavos; Σ = pago |

**Invariantes**: `pago = Σ formas`; conclusão exige `pago >= total` e ≥ 1 item; ao concluir, decrementa
`livro.estoque` por item (piso 0).

### ItemPedido
| Campo | Tipo | Regras |
|---|---|---|
| pedido_numero | i64 | FK → pedido.numero |
| codigo | String | FK → livro.codigo |
| titulo | String | **snapshot** no momento da venda (FR-016) |
| preco_centavos | i64 | **snapshot** |
| qtd | i64 | ≥ 1 (stepper nunca < 1); mesmo código soma qtd |

### Usuario (gate de relatórios)
| Campo | Tipo | Regras |
|---|---|---|
| usuario | String | **PK**; default operacional "adm" |
| senha_hash | String | hash; legado em texto → **rehash** no 1º uso (D10) |
| nome | Option<String> | |

## Esquema SQLite (alvo)

> DDL conceitual; a fonte de verdade é `sea-orm-migration` (idempotente, por comando — D3).

```sql
CREATE TABLE IF NOT EXISTS livro (
  codigo TEXT PRIMARY KEY, titulo TEXT NOT NULL, autor TEXT,
  preco_centavos INTEGER NOT NULL DEFAULT 0, categoria INTEGER NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0, descricao TEXT, busca_norm TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_livro_busca ON livro(busca_norm);

CREATE TABLE IF NOT EXISTS pedido (
  numero INTEGER PRIMARY KEY, cliente TEXT NOT NULL DEFAULT 'CLIENTE',
  turno TEXT NOT NULL, data TEXT NOT NULL, total_centavos INTEGER NOT NULL,
  val_cartao INTEGER NOT NULL DEFAULT 0, val_dinheiro INTEGER NOT NULL DEFAULT 0,
  val_pix INTEGER NOT NULL DEFAULT 0, val_ministerio INTEGER NOT NULL DEFAULT 0,
  val_vale INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_numero INTEGER NOT NULL REFERENCES pedido(numero),
  codigo TEXT NOT NULL, -- snapshot; SEM FK p/ livro: vendas históricas referenciam
                        -- códigos que podem não estar mais no acervo (ver migração)
  titulo TEXT NOT NULL, preco_centavos INTEGER NOT NULL, qtd INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_pedido ON item_pedido(pedido_numero);

CREATE TABLE IF NOT EXISTS usuario (
  usuario TEXT PRIMARY KEY, senha_hash TEXT NOT NULL, nome TEXT
);
```

## Mapeamento do legado (Access → novo)

Fonte: `../Livraria/livraria.mdb` (lido por mdbtools). Upsert idempotente (D6).

### `cadastro` → `livro`
| Legado | Novo | Transformação |
|---|---|---|
| cdbar | codigo | chave de upsert; descartar vazios/ inválidos (logar) |
| cdtitulo | titulo | |
| cdautor | autor | |
| cdvalor (Currency) | preco_centavos | × 100, arredondar |
| cdcategoria (texto) | categoria | numérico "0".."6" → enum; senão → 0 (FR-066) |
| cdestoque (Double) | estoque | arredondar; piso 0 |
| cddescricao | descricao | |
| cdpromocao/cdvalorpromo | — | **ignorado** (fora de escopo v1) |
| — | busca_norm | derivar de titulo+autor |

### `venda` → `pedido` + `item_pedido`
- Agrupar linhas por `vdpedido` (número). Linhas de item → `item_pedido` (titulo=`vdtitulo`,
  preco=`vdvalor`×100, qtd=`vdquanto`, codigo=`vdbar`).
- Linha-resumo (`vdtitulo` = "Total do Pedido No. :") → `pedido.total_centavos`=`vdtotal`×100,
  `cliente`=`vdnome`, `turno`= map(`vdturma`), `data`=parse(`vddata` dd/mm/yyyy → ISO).
- **Split de pagamento**: se colunas `vdcartao..vdvale` > 0, usar; senão **derivar** de `vdmetodo` por
  item (C→Cartão, D→Dinheiro, P→PIX, M→Ministério, V→Vale), somando o total do item à forma.
- `numero` futuro = MAX(numero) importado + 1 (FR-068).
- **Relatório de migração**: contar livros/pedidos inseridos vs. atualizados, códigos descartados,
  divergências de centavos.

### `usuario` → `usuario`
`codusuario`→usuario, `codnome`→nome, `codsenha`→ rehash no 1º login (texto no legado).

### `carrinho`
**Descartado** (estado transitório do legado).

## Estados / transições

- **Livro**: criado → editado → (soft) excluído. Exclusão com histórico de vendas: **soft-delete**
  recomendado (preserva integridade com `item_pedido`); item guarda snapshot, então relatórios antigos
  não quebram. *(Confirmar em tasks; default soft-delete.)*
- **Pedido**: rascunho (em memória no PDV, não persistido) → **concluído** (gravado, estoque baixado).
  Sem edição pós-conclusão (snapshot imutável).
