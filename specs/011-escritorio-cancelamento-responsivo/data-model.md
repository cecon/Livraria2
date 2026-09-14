# Data Model — Cancelar/reabrir venda (feature 011)

Não cria entidades novas — usa as existentes (feature 006/009). Foco: **estados e invariantes** do
cancelamento e a **identidade determinística** que garante idempotência no sync.

## Entidades envolvidas

| Entidade | Papel no cancelamento |
|---|---|
| `pedido` | `cancelado` (bool) + `cancelado_em`. **Mutável (LWW)**. Cancelar marca, nunca apaga (auditoria). |
| `movimento_estoque` | Estorno = movimento `tipo='estorno'`, `qtd = -net(saidas)`, `referencia = <nº pedido>`. **Evento append-only**. |
| `alocacao_venda` | Carimbos consumidos pela venda (por item/destinação). Fonte da devolução. |
| `transferencia_destinacao` | Registro compensatório que **devolve** o carimbo à destinação de origem. |

## Regras / invariantes

- **INV-1 (janela)**: só cancela se `pode_acessar_escritorio(admin)` **e** `pode_cancelar_venda(data,
  hoje)` (≤ 5 dias). Fora disso → recusa (FR-004/SC-003).
- **INV-2 (estorno = anula a saída)**: após cancelar, `Σ(saida_venda + estorno) por livro do pedido = 0`
  → o estoque volta exatamente ao valor pré-venda (SC-001).
- **INV-3 (carimbo devolvido)**: o saldo da destinação volta ao valor pré-venda (SC-002).
- **INV-4 (idempotência local)**: `estornar_saidas` só age em `net < 0`; devolver carimbo só se o pedido
  **não** estava cancelado. Repetir = no-op.
- **INV-5 (idempotência no sync)**: o `sync_uid` do estorno é **determinístico** por pedido/livro →
  cancelamento concorrente PDV+nuvem converge para **um** estorno (SC-004). Mesma técnica para o
  registro de devolução de carimbo.
- **INV-6 (auditoria)**: pedido cancelado **some dos totais** do período mas **permanece** visível
  (SC-005).

## Identidade determinística (o coração do D2)

```
sync_uid(estorno)  = uuidv5(NS_LIVRARIA, "estorno:"  || pedido_numero || ":" || livro_uid)
sync_uid(devolucao)= uuidv5(NS_LIVRARIA, "devcarimbo:" || pedido_numero || ":" || alocacao_id)
```

- Calculado **igual** nos dois lados (RPC SQL e PDV Rust). `NS_LIVRARIA = f5bc34a5-3b33-409c-96d0-a56664436ba7`
  (UUID **literal** fixo, hardcoded idêntico nos dois runtimes).
- No merge, eventos com o mesmo `sync_uid` → `DO NOTHING` → deduplicam.

## Transições de estado do `pedido`

```
ativo ──cancelar (dentro da janela, admin)──▶ cancelado   [estorna estoque + devolve carimbo]
cancelado ──cancelar de novo──▶ cancelado                 [no-op idempotente]
ativo ──janela expirada / não-admin──▶ ativo              [recusa]
reabrir = cancelar(ativo) + clona itens no caixa (nova venda separada)
```

## Responsivo (US2) — sem modelo de dados novo

Ajuste de apresentação: breakpoints, sidebar off-canvas, tabelas→cards. Nada persiste; só layout.
