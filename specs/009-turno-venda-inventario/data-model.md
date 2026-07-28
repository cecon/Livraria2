# Data Model — Feature 009: Turno, Venda e Inventário na nuvem

Fase 1 do plano. Entidades novas/alteradas, o esquema idempotente nas duas pontas e as regras que vêm
do domínio. Dinheiro sempre em **inteiro de centavos**. Referências cruzadas por **`sync_uid`** na nuvem.

## Entidade nova: `TurnoOperacao` (domínio puro)

`crates/livraria-domain/src/turno_operacao.rs` — sem I/O, testável sem UI/banco.

| Campo | Tipo | Regra |
|---|---|---|
| `operador` | `String` (uid/identidade) | quem abriu; obrigatório |
| `caixa_inicial` | `Dinheiro` (centavos) | opcional; default `ZERO` |
| `status` | `StatusTurno { Aberto, Encerrado }` | inicia `Aberto` |
| `abertura` | `String` ISO | data/hora de abertura |
| `encerramento` | `Option<Fechamento>` | preenchido só ao encerrar |

**Funções puras** (expostas via WASM — ver contracts):

- `abrir(operador, caixa_inicial: Option<Dinheiro>) -> TurnoOperacao` — status `Aberto`.
- `pode_registrar_venda(status) -> bool` — `true` só se `Aberto`.
- `proximo_numero(qtd_no_turno: i64) -> i64` — `qtd_no_turno + 1` (1..n por turno).
- `resumir_fechamento(pagamentos_do_turno, caixa_inicial, dinheiro_forma_id) -> ResumoCaixa` — agrega
  **totais por forma** (informativos) e computa o **esperado em dinheiro** = `caixa_inicial + Σ recebido na
  forma Dinheiro` (a forma Dinheiro é resolvida pela aplicação por `dinheiro_forma_id`, chave estável).
- `encerrar(resumo, conferido_dinheiro: Dinheiro) -> Fechamento { esperado, conferido, diferenca }` —
  `diferenca = conferido − esperado`; não bloqueia se `diferenca ≠ 0`; muda status para `Encerrado`.

**Tipos auxiliares**:

- `ResumoCaixa { qtd_vendas: i64, por_forma: Vec<(forma_id, Dinheiro)>, esperado_dinheiro: Dinheiro }`
- `Fechamento { esperado: Dinheiro, conferido: Dinheiro, diferenca: i64 /* centavos, pode ser < 0 */ }`

> A forma "Dinheiro" é resolvida pela **aplicação** por chave estável (`ChaveSistema::Dinheiro`, ADR-0013):
> o domínio recebe `dinheiro_forma_id`, nunca rótulos.

**Estados**: `Aberto → Encerrado` (unidirecional). Turno `Encerrado` recusa novas vendas
(`pode_registrar_venda == false`).

## Entidade alterada: `Pedido` (venda)

Sem mudança nas regras já existentes (`total`, `restante`, `troco`, `validar_conclusao`). Ganha **vínculo ao
turno** na persistência (não no struct puro do domínio, que permanece agnóstico):

- `pedido.turno_uid` → `turno_operacao(sync_uid)` (FK por `sync_uid`). Nulo tolerado para pedidos **legados**;
  exigido em **novas** vendas.
- `pedido.numero_no_turno` → `proximo_numero(...)` (1..n dentro do turno). O `pedido.numero` global contínuo
  **permanece** inalterado.

## Reuso (sem alteração): Inventário

`inventario::{ModoInventario(Parcial|Total), StatusSessao, contagem_efetiva, resumir}` e
`estoque::diferenca_contagem` já existem. O Escritório os consome via WASM. A sessão de contagem é **client-side**
(rascunho em `localStorage`); o resultado durável são os **ajustes** gravados em `movimento_estoque` (D5 do
research). Nenhuma tabela de inventário é criada na nuvem.

## Esquema — SQLite local (`m009`, idempotente)

Aplicada em `inicializar_schema()` após `m008` (estilo `aplicar` de m004/m006/m008):

```text
CREATE TABLE IF NOT EXISTS turno_operacao (
  sync_uid        TEXT PRIMARY KEY,
  operador        TEXT,                 -- operador (uid)
  caixa_inicial_centavos INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'aberto',   -- 'aberto' | 'encerrado'
  abertura        TEXT NOT NULL,        -- ISO
  encerramento    TEXT,                 -- ISO (nulo até encerrar)
  esperado_centavos  INTEGER,           -- fechamento (nulo até encerrar)
  conferido_centavos INTEGER,
  diferenca_centavos INTEGER,
  origem          TEXT, atualizado_em TEXT, excluido_em TEXT, criado_por TEXT, sincronizado_em TEXT
);
-- ALTERs tolerando "duplicate column":
ALTER TABLE pedido ADD COLUMN turno_uid TEXT;         -- FK lógica por sync_uid
ALTER TABLE pedido ADD COLUMN numero_no_turno INTEGER;
```

## Esquema — Nuvem (`0010_turno.sql`, idempotente)

Mirror com `sync_uid` + colunas de sync + RLS `to authenticated`, seguindo `0001_schema_espelho.sql`:

```text
CREATE TABLE IF NOT EXISTS turno_operacao (
  sync_uid uuid PRIMARY KEY,
  operador_uid uuid REFERENCES usuario(sync_uid),
  caixa_inicial_centavos bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  abertura text NOT NULL,
  encerramento text,
  esperado_centavos bigint,
  conferido_centavos bigint,
  diferenca_centavos bigint,
  origem text, atualizado_em timestamptz, excluido_em timestamptz,
  criado_por uuid, sincronizado_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_turno_operacao_sinc ON turno_operacao (sincronizado_em);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS turno_uid uuid REFERENCES turno_operacao(sync_uid);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS numero_no_turno bigint;
-- RLS: enable + policies to authenticated (mesmo padrão de 0002_rls_e_views.sql)
```

**Convergência**: `turno_operacao` entra na `ORDEM_DEPENDENCIA` da sincronização **antes de `pedido`**
(ADR-0021). Campos mutáveis (status, encerramento) convergem por **LWW** (`atualizado_em` de servidor).

## Regras de validação (fonte = domínio)

| Regra | Fonte (domínio) | Onde aplica |
|---|---|---|
| Venda exige turno aberto | `TurnoOperacao::pode_registrar_venda` | PDV + Escritório, antes de gravar |
| Pedido Nº por turno | `proximo_numero(qtd)` | ao concluir venda |
| Baixa de estoque limitada ao saldo | `estoque::clamp_baixa_venda` | movimento de saída da venda |
| Conclusão da venda (≥1 item, pago ≥ total, troco só dinheiro) | `Pedido::validar_conclusao` | checkout |
| Troco / restante | `Pedido::{troco,restante}` | checkout |
| Contagem efetiva (parcial/total) | `inventario::contagem_efetiva` | fechamento do inventário |
| Diferença de contagem | `estoque::diferenca_contagem` | reconciliação |
| Resumo do inventário | `inventario::resumir` | resumo/relatório |
| Fechamento de caixa (esperado dinheiro, diferença) | `TurnoOperacao::{resumir_fechamento,encerrar}` | encerrar turno |
| Um turno aberto por operador/origem | consulta de estado (adapter) + `status Aberto` (domínio) | abrir turno |

## Portas do adapter (implementadas na nuvem — supabase-js)

Interfaces que o Escritório implementa contra o Supabase (detalhe em `contracts/`):

- **TurnoPort**: `abrirTurno(caixaInicial?)`, `turnoAberto()`, `contarPedidosDoTurno(turnoUid)`,
  `encerrarTurno(turnoUid, conferidoDinheiro)`, `listarTurnos()`.
- **VendaPort**: `proximoNumeroNoTurno(turnoUid)`, `registrarVenda(input)` (grava pedido+itens+pagamentos+
  movimento+alocação), `listarVendasDoDia()`.
- **InventarioPort** (client-side session): `saldosParaContagem(codigos?)`, `aplicarAjustes(ajustes)`
  (grava `movimento_estoque` tipo ajuste).

Todas herdam o padrão dos adapters da 008: upsert por `sync_uid` (`crypto.randomUUID()`), LWW por
`atualizado_em`, soft-delete via `excluido_em`, `origem="escritorio"`, `criado_por`/`operador_uid` do
**`app_user`** (o `usuario.sync_uid` real do operador logado — **não** `auth.uid()`, que é compartilhado sob
a sessão de serviço do #15; ver D10 do research), saldo derivado de `movimento_estoque` (nunca coluna).
