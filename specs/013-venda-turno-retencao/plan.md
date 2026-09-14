# Implementation Plan: PDV — venda vinculada a turno, sync só-sobe e retenção de 45 dias

**Branch**: `013-venda-turno-retencao` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-venda-turno-retencao/spec.md`

## Summary

Fase 3 do "a nuvem manda": o PDV vira operação de **turno corrente**. (1) Toda venda/cancelamento exige **turno aberto**; há **um único turno aberto por PDV**, compartilhado por quem logar. (2) A sincronização de **vendas é push-only** — o PDV envia seus fatos e **não baixa mais vendas**; só o **saldo publicado do livro** continua descendo. (3) O PDV **poda localmente** turnos encerrados+sincronizados com > 45 dias (a **nuvem retém tudo**). (4) O turno passa a ser **único por máquina** (nome do PC compõe a identidade) e a **numeração de venda reinicia em 1 por turno**. (5) A nuvem pode **fechar** um turno (o fechamento **desce** ao PDV); se houver vendas pendentes, o PDV **cria um novo turno** para elas. (6) Escritório **enxerga todos os turnos**; PDV mostra **PC + operador** no header e a **lista de vendas do turno** na tela inicial.

Principal ponto técnico: como o PDV não baixa mais vendas, o sinal "venda já incorporada ao `saldo_publicado`" (que o fix v26.8.3 lê de `estoque_status` puxado) passa a ser um **marcador local** de "já sincronizada alguma vez".

## Technical Context

**Language/Version**: Rust (PDV core/adapters + `crates/livraria-domain` nativo/WASM); TypeScript + React 19 (PDV UI Tauri); TypeScript + Next.js 15 (escritório); Postgres (Supabase, RPC/migração `plpgsql`).

**Primary Dependencies**: sincronização (feature 007 — `replica_mapa`/`replica_sync`, `ORDEM_DEPENDENCIA`, cursor por `sincronizado_em`); turno de operação (feature 009 — `turno_operacao`, domínio `turno_operacao.rs` com `StatusTurno`, `pode_registrar_venda`, `proximo_numero`); saldo operacional (feature 011 + fix v26.8.3 — `saldo_publicado`, `estoque_status`); `@livraria/domain` (WASM); retaguarda autenticada (008/010).

**Storage**: SQLite (réplica do PDV) — `pedido`/`item_pedido`/`pagamento_pedido`/`alocacao_venda` viram **push-only**; `turno_operacao` bidirecional (o fechamento desce); poda local por turno. Postgres (nuvem) — autoridade e histórico permanente; backfill do turno padrão global.

**Testing**: `cargo test` (domínio + integração dos repositórios do PDV — numeração por turno, guardas de turno, saldo operacional com marcador local, poda FK-safe, reconciliação de fechamento); `npm test`/`npm run build` (PDV UI); `npm run build -w apps/escritorio` (visão de turnos); homologação SQL em `apps/nuvem/tests/` (backfill idempotente).

**Target Platform**: Desktop (Tauri, offline-first) + Web (Next.js) + Postgres.

**Project Type**: Híbrido em workspace (`src-tauri`, `src`, `crates/*`, `apps/*`, `packages/*`).

**Performance Goals**: operação de balcão fluida; a poda roda no boot/pós-sync sem travar a UI; a visão de turnos do escritório atualiza no ciclo de sync.

**Constraints**: **offline-first** para venda/cancelamento (invariante v2.0.0); **≤300 linhas/arquivo**; **migrations idempotentes**; **poda FK-safe** (filha→pai, lição do incidente m013/787); pt-BR; dinheiro em centavos; nenhum segredo administrativo no cliente.

**Scale/Scope**: base pequena; poucos PDVs. Toca: domínio (numeração por turno, guardas), PDV Rust (push-only, marcador local, poda, reconciliação de fechamento, hostname), PDV React (header + tela inicial), escritório Next.js (visão + fechar turno), Postgres (backfill do turno padrão global).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Hexagonal/SOLID**: ✅ As regras novas nascem no **domínio** (`turno_operacao`): numeração por turno (`proximo_numero` já existe), guarda de turno único aberto, janela de poda (45 dias), regra "cancela só do turno aberto". A orquestração (push-only, poda, hostname, reconciliação de fechamento) vive nos **adapters** por porta. Nenhuma regra em UI/SQL sem porta.
- **II — KISS/DRY/YAGNI**: ✅ (melhora) push-only **remove** o pull de vendas (menos sync); o marcador local **substitui** o `estoque_status` puxado (uma fonte); a numeração por turno **reusa `pedido.numero_no_turno` que já existe** (m009) — nada novo, só passa a ser o número exibido.
- **III — ≤300 linhas**: ✅ poda em módulo próprio; visão de turnos do escritório em componentes; guardas no domínio.
- **IV — Idempotência por comando**: ✅ migração local (colunas `maquina`/`numero_turno`/`ja_sincronizado`) e a poda idempotentes (FK-safe filha→pai); backfill do turno padrão na nuvem idempotente (`if not exists` + `UPDATE ... WHERE turno_uid IS NULL`).
- **V — Guardrails/ADR**: registrar **ADR-0025** (venda push-only + identidade de turno por máquina + numeração por turno + poda local de 45 dias + reconciliação de fechamento). Hook de 300 linhas nos arquivos novos.
- **VI — pt-BR/domínio**: ⚠️→✅ **tensão tratada**: a constituição VI preserva "número de pedido **sequencial contínuo**". Esta feature exibe a numeração **por turno**. Resolução: o `numero` contínuo **permanece** como PK/FK interno (preservado); o "Pedido Nº" exibido passa a ser o **`numero_no_turno`** (1..N, já existente na m009). O contínuo não é removido — muda só a **exibição** — registrado em **ADR-0025**. Demais termos (turno, Pedido Nº, `R$` em centavos) preservados.

**Invariante offline (v2.0.0)**: ✅ venda/cancelamento seguem 100% offline. Push-only **reforça** o invariante (o PDV produz fatos e sobe). O fechamento desce da nuvem mas **não bloqueia** vender offline (se preciso, o PDV cria um novo turno — FR-024). O saldo operacional continua derivado do publicado ± fatos locais, agora com marcador local em vez de estado puxado.

**Resultado**: passa. Única tensão (VI, numeração) **resolvida** mantendo o número contínuo interno + ADR-0025.

## Project Structure

### Documentation (this feature)

```text
specs/013-venda-turno-retencao/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/          # comandos Tauri do turno/venda + recurso de sync (push-only) +
│                       #   contrato da visão/fechamento de turno no escritório + backfill
├── checklists/requirements.md
└── tasks.md            # (/speckit-tasks)
```

### Source Code (repository root)

```text
crates/livraria-domain/src/
└── turno_operacao.rs      # + guarda "um turno aberto", "cancela só do turno aberto", janela de poda
                           #   (numeração por turno já existe em proximo_numero)

src-tauri/src/
├── migration/m014.rs      # colunas locais NOVAS: turno_operacao.maquina + pedido.ja_sincronizado
                           #   (pedido.turno_uid e pedido.numero_no_turno JÁ existem — m009)
├── application/
│   ├── turno.rs           # abrir/continuar (turno único), fechar; numero_turno; identidade por máquina
│   ├── venda.rs           # guarda de turno aberto na venda
│   ├── cancelamento.rs    # guarda "só turno aberto"
│   ├── poda.rs            # NOVO: podar turnos encerrados+sinc.+>45d (FK-safe)
│   └── ports*.rs          # portas: Maquina (hostname), TurnoRepo (reconciliação de fechamento)
├── adapters/persistencia/
│   ├── replica_mapa.rs    # push_only(pedido, item_pedido, pagamento_pedido, alocacao_venda)
│   ├── replica_sync.rs    # pull ignora push_only; aplica fechamento de turno; reconciliação FR-024
│   ├── pedido_repo.rs     # numero_turno; marca ja_sincronizado no push confirmado
│   ├── estoque_repo.rs    # saldo_operacional: +cancelamento usa ja_sincronizado (não estoque_status)
│   └── maquina.rs         # NOVO: hostname do PC
└── commands*.rs           # header (pc+operador), lista de vendas do turno

src/ (PDV React)
├── components/Header      # PC + operador do turno aberto (ou "sem turno")
└── routes/Inicio.tsx      # lista de vendas do turno no formato do relatório

apps/escritorio/           # visão de turnos (abertos/fechados) + ação "fechar turno"
apps/nuvem/migrations/     # 0014_turno_padrao_backfill.sql (turno global + vincular órfãs)
```

**Structure Decision**: workspace híbrido existente. O grosso é PDV (Rust domínio+adapters, React header/início); a nuvem entra com um backfill idempotente; o escritório ganha uma visão de turnos. Sem novos projetos.

## Complexity Tracking

> Sem violações que exijam justificativa. A única tensão (numeração contínua × por turno, Princípio VI) é resolvida **sem** quebrar o invariante: mantém-se o número contínuo interno (`numero`, PK/FK) e adiciona-se `numero_turno` para exibição, documentado em ADR-0025. Nenhuma complexidade acidental adicionada.
