# Research — Cancelar/reabrir venda + responsivo (feature 011)

## D1 — Onde a lógica de cancelamento roda (clarify Q1)

- **Decisão**: **RPC transacional na nuvem** `cancelar_venda(p_admin, p_pedido)` (`SECURITY DEFINER`).
  Numa transação: valida admin + janela; devolve carimbos; estorna estoque; marca `pedido.cancelado`.
- **Rationale**: reusa o padrão seguro da 010 (escrita sensível no Postgres, atômica); o Escritório só
  chama e mostra. Evita meio-caminho (falha no cliente deixaria estado inconsistente).
- **Alternativas rejeitadas**: lógica no servidor Next.js (várias chamadas → risco de estado parcial);
  reusar o Rust do PDV (o Escritório não fala com o Rust).

## D2 — Idempotência do estorno ATRAVÉS do sync (clarify Q2) — o ponto crítico

- **Decisão**: o **movimento de estorno** tem **`sync_uid` determinístico** = `uuidv5(NS, "estorno:" ||
  pedido || ":" || livro)`. Assim, se o PDV (offline) e a nuvem cancelarem o **mesmo** pedido, os dois
  estornos têm o **mesmo** `sync_uid` → no merge (evento = `DO NOTHING` por `sync_uid`) **deduplicam** →
  **um** estorno. Combina com o guard local existente (`estornar_saidas`: `HAVING net < 0` só estorna o
  que ainda falta) e com `pedido.cancelado` convergindo por **LWW**.
- **Rationale**: eventos append-only não podem confiar em uid aleatório para operações que os dois lados
  podem gerar; a identidade determinística é a forma canônica de idempotência distribuída (mesma ideia
  do ADR-0016, agora estendida a estorno).
- **Implicação**: o **PDV também passa a gerar o `sync_uid` do estorno de forma determinística** (hoje é
  aleatório via backfill m008) — mudança pequena em `pedido_sql.rs`, com a **mesma fórmula** da RPC.
- **Alternativas rejeitadas**: uid aleatório (dobra o estorno em cancelamento concorrente); "só um lado
  pode cancelar" (quebra offline / tira da retaguarda); apagar `saida_venda` (viola append-only).

## D3 — Janela de 5 dias (regra única)

- **Decisão**: reusar `livraria_domain::pedido::pode_cancelar_venda(data, hoje)` — já existe e já está no
  WASM. O Escritório checa **antes** de habilitar a ação (UX) **e** a RPC **reforça** (segurança).
- **Rationale**: DRY — a regra vive num lugar só (domínio); nunca reimplementada em SQL/TS.

## D4 — Devolução de carimbos na nuvem

- **Decisão**: a RPC espelha `devolver_alocacoes_pedido`: lê `alocacao_venda` do pedido e devolve os
  carimbos à destinação de origem (registro compensatório em `transferencia_destinacao`, idempotente por
  identidade determinística — mesma técnica do D2). Só executa se o pedido **ainda não** estava
  cancelado (guard).
- **Rationale**: paridade com o PDV; `transferencia_destinacao` já existe na nuvem e sincroniza.
- **Risco/nota**: é a parte mais delicada — **teste de conformância** obrigatório (saldo da destinação
  volta ao valor exato, SC-002) antes de tocar produção.

## D5 — Reabrir = cancelar + clonar (US3)

- **Decisão**: **reabrir** chama `cancelar_venda` e, no sucesso, carrega os **itens** da venda no caixa
  do Escritório (estado client-side), pronto para editar/concluir. Não é "edição" da venda original.
- **Rationale**: mesmo comportamento do PDV (`ListaVendas.reabrir` → clona no PDV). Nenhuma venda nova é
  criada se o admin desistir (a original já ficou cancelada; o estoque já voltou).
- **Alternativas rejeitadas**: editar a venda original in-place (quebra auditoria; diverge do PDV).

## D6 — Responsivo: base única por breakpoints (clarify Q2 responsivo)

- **Decisão**: adaptar o layout existente com **breakpoints Tailwind** (mobile-first):
  - **Sidebar** vira **off-canvas/drawer** abaixo de `md` (botão "hambúrguer"); fixa no desktop.
  - **Grids** de 4 colunas → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - **Tabelas largas** (livros, vendas, lançamentos) → **cards empilhados** no mobile (o mesmo dado, sem
    rolagem horizontal); tabela no desktop.
  - **Caixa/venda**: colunas empilham no mobile (busca+carrinho em cima, pagamento embaixo), alvos de
    toque ≥ 40px.
  - Root sem `overflow-x`; larguras relativas.
- **Rationale**: uma base, zero telas duplicadas (FR-016), reusa `@livraria/ui`. Menos código, sem
  divergência desktop↔mobile.
- **Alternativas rejeitadas**: rotas/componentes mobile separados (duplica UI, diverge, mais manutenção).

## D7 — Numeração de migração

- **Decisão**: nuvem **`0011_cancelar_venda.sql`**. Confirmado: `apps/nuvem/migrations/` tem `0001`–`0010`
  ocupados (`0010_turno.sql` é da feature 009) → o próximo livre é **`0011`**. (Lição do ADR-0019: conferir
  a numeração real antes de escrever, para não colidir.)
