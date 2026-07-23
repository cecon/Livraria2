# ADR-0021 — Turno de operação: entidade de domínio, Pedido Nº por turno, abrir/encerrar

**Status**: Aceito · **Data**: 2026-07-22

## Contexto
Com **dois pontos de venda** (PDV e Escritório) registrando vendas, o invariante "número de pedido
**sequencial contínuo**" (Constituição VI) fica ambíguo: dois lugares gerando números **colidem**. A
sincronização já dá identidade real por `sync_uid` (ADR-0016), mas o **número exibido ao usuário** precisa
de uma regra. Na clarificação da feature 008, o usuário decidiu introduzir o conceito de **turno de
operação** (sessão com abrir/encerrar) e conter a numeração dentro dele.

> **Nomenclatura**: "Turno de operação" (sessão com abre/fecha) é **distinto** do enum `Turno` já
> existente no domínio (turno por **horário** — Manhã/Tarde, `pagamento.rs`). O novo tipo é
> **`TurnoOperacao`** em `crates/livraria-domain/src/turno_operacao.rs` — nunca reusar o nome `Turno`.

## Decisão (specs/008-escritorio-espelho-pdv/research.md D10–D13; clarify 2026-07-22)
- **Entidade pura no domínio** `TurnoOperacao` (crate `livraria-domain`, também via WASM — ADR-0022), com
  funções puras: `abrir(operador, caixa_inicial?)`, `pode_registrar_venda(status)`,
  `proximo_numero(qtd_no_turno) -> n`, `resumir_fechamento(pagamentos_do_turno) -> resumo`,
  `encerrar(resumo, conferido) -> {esperado, conferido, diferenca}`. Estado `Aberto`/`Encerrado`.
- **Abertura por ação explícita** ("Abrir turno"), com **valor inicial de caixa opcional**. Uma venda só
  pode ser registrada **dentro de um turno aberto**; sem turno, é bloqueada com orientação.
- **Pedido Nº sequencial por turno (1..n)**: `pedido.numero_no_turno` vem de `proximo_numero(...)` sobre a
  **contagem local dos pedidos daquele turno**. Como cada turno pertence a **uma origem** (um
  dispositivo/operador) e tem `sync_uid` distinto, a numeração é **conflict-free** entre PDV e Escritório
  e **calculável offline** (sem alocador central) — preservando o invariante offline do PDV.
- **Encerramento = fechamento de caixa**: o resumo (totais por forma de pagamento, qtd de vendas, esperado
  vs. conferido, diferença) é computado pelo domínio a partir dos `pagamento_pedido` do turno; a UI coleta
  o conferido; a diferença é registrada sem impedir o encerramento. Turno encerrado **não aceita** novas
  vendas.
- **Esquema (idempotente, Princípio IV)**: `m009` (SQLite) e `0006_turno.sql` (nuvem, mirror com
  `sync_uid` + colunas de sync + RLS `to authenticated`) criam `turno_operacao` e adicionam
  `pedido.turno_uid`/`pedido.numero_no_turno` (FK por `sync_uid`). Pedidos legados sem turno toleram
  `turno_uid` nulo; turno só é exigido em **novas** vendas.
- **Sincronização/convergência**: `turno_operacao` entra na `ORDEM_DEPENDENCIA` **antes de `pedido`**;
  campos mutáveis do turno (status, encerramento) convergem por **LWW** (`atualizado_em` de servidor). O
  turno é *origin-owned*, então conflito é improvável.
- **Escopo**: o turno vale para **PDV e Escritório** (mesmo conceito de domínio) — exceção explícita à
  regra "só paridade" da feature 008, registrada na clarificação.

## Consequências
- **Positivas**: resolve a numeração com dois pontos de venda **sem colisão e sem quebrar o offline**;
  dá controle operacional (abrir/fechar caixa); regra única compartilhada PDV↔nuvem (DRY, via WASM).
- **Custos/risco**: entidade + esquema novos nas duas pontas (migrations `m009`/`0006`); política de
  **turno esquecido aberto** (virada de dia) a definir (alerta/encerramento assistido, nunca em silêncio);
  telas novas de abrir/encerrar; pedidos legados sem `turno_uid` a tratar.
- **Alternativas rejeitadas**: numeração global contínua com alocador central (quebra offline, reintroduz
  colisão); faixas por origem sem turno (menos aderente ao pedido do usuário); só marcar fim sem
  fechamento de caixa (não atende à decisão).
