# Research & Decisions — Sistema de Estoque & Vendas (Livraria 2)

Phase 0 do `/speckit-plan`. Consolida as decisões técnicas. Cada decisão vira um ADR em `docs/adr/`
(ver `docs/adr/`). Sem `NEEDS CLARIFICATION` pendentes.

---

## D1 — Onde vive o domínio: núcleo Rust (não TypeScript)

- **Decisão**: domínio e casos de uso em **Rust** (`src-tauri`), expostos à UI por comandos Tauri
  (`invoke`). React é adapter de UI.
- **Rationale**: cumpre Hexagonal/SOLID (Princípio I) com um núcleo testável por `cargo test` sem UI nem
  banco; concentra as regras num só lugar (DRY); evita lógica de negócio espalhada no front. Rust dá
  tipos fortes e erros explícitos para regras financeiras/estoque.
- **Alternativas**: domínio em TS com `tauri-plugin-sql` (regras no front, mais difícil de isolar do
  React; rejeitado por acoplamento). Hybrid (duplicaria regras; fere DRY).

## D2 — ORM / camada de dados: SeaORM + SQLite

- **Decisão**: **SeaORM** (async, `sqlx-sqlite`, runtime tokio) como ORM no **adapter de persistência**.
  Entidades SeaORM ficam **fora do domínio**; os repositórios implementam as portas (`LivroRepo`,
  `PedidoRepo`) e convertem entidade ↔ tipo de domínio.
- **Rationale**: o usuário pediu ORM (ADR). SeaORM é async (casa com o tokio do Tauri), tem migrations
  programáticas e geração de entidades; mantém o domínio limpo. Arquivos pequenos (1 entidade por tabela)
  respeitam o limite de 300 linhas.
- **Alternativas**: Diesel (síncrono; `schema.rs` tende a crescer; bom, mas async encaixa melhor);
  sqlx puro (não é ORM — o usuário pediu ORM); rusqlite (mais manual, menos "ORM"). Rejeitados.

## D3 — Migrations por comando e idempotentes

- **Decisão**: `sea-orm-migration` (migrations em Rust, uma por arquivo) aplicadas por **comando**
  (subcomando/ботão "inicializar dados" + na inicialização do app). O migrator rastreia migrations
  aplicadas (tabela `seaql_migrations`), garantindo idempotência; DDL usa `IF NOT EXISTS` onde fizer
  sentido. Nenhuma alteração manual de schema.
- **Rationale**: Princípio IV. Re-aplicar em base nova/existente converge sem erro nem perda.
- **Alternativas**: SQL solto aplicado na mão (não idempotente, frágil); refinery (válido, mas SeaORM já
  traz o migrator). Rejeitados.

## D4 — Dinheiro como inteiro em centavos (i64)

- **Decisão**: todo valor monetário é **inteiro de centavos** (`i64`) no domínio e no banco; formatação
  pt-BR (`R$ 1.234,56`) só na borda; parsing aceita vírgula decimal.
- **Rationale**: SC-004 exige reconciliação exata (R$ 0,00). Float (REAL) acumula erro. Centavos eliminam
  imprecisão e simplificam somas/conferências.
- **Alternativas**: REAL/f64 (legado usa; erro de arredondamento — rejeitado); decimal de string
  (overkill para 2 casas — YAGNI).

## D5 — Leitura do legado Access via mdbtools (subprocesso)

- **Decisão**: o adapter `legado/mdb_importer.rs` lê `../Livraria/livraria.mdb` chamando **mdbtools**
  (`mdb-export`) como subprocesso, parseia CSV e aplica upsert. mdbtools é dependência de
  **transição/dev** (já instalada no ambiente).
- **Rationale**: não há leitor `.mdb` puro-Rust maduro; mdbtools é estável e já disponível. Import é
  recorrente (transição), então ler ao vivo é melhor que conversão única.
- **Alternativas**: converter `.mdb`→SQLite uma vez (não cobre re-sync da transição); crate Rust de
  Access (imaturo). Rejeitados. **Risco**: mdbtools deve existir na máquina de import (aceitável: só o
  mantenedor roda o import na transição) — documentado.

## D6 — Importação idempotente por upsert + reconstrução normalizada

- **Decisão**: import = **upsert** por chave estável (livro: código de barras; pedido: número).
  Livros: `cadastro` → tabela `livro` (categoria texto→enum 0–6; não-numérico/vazio→0). Vendas: `venda`
  (desnormalizada) → `pedido` + `item_pedido`, agrupando por número de pedido e usando a linha-resumo
  "Total do Pedido No. :" para o total/cliente. Split de pagamento **derivado** de `vdmetodo` por item
  (mapa C→Cartão, D→Dinheiro, P→PIX, M→Ministério, V→Vale) quando as colunas de valor vêm zeradas.
  Registros que não vieram do legado são **preservados** (não sobrescreve dados criados no novo sistema).
  Gera **relatório de migração** com divergências.
- **Rationale**: Clarifications da spec (Q1/Q3) + Princípio IV.
- **Alternativas**: arquivo read-only (usuário preferiu normalizado); só totais (perde itens). Rejeitados.
- **A confirmar na implementação**: mapa exato de `vdmetodo` e de `vdturma` (turno) — validar contra
  amostra real antes de migrar tudo; default seguro para valores desconhecidos.

## D7 — Guardrail de 300 linhas (hook + pre-commit)

- **Decisão**: script `scripts/check-file-size` conta **linhas significativas** (exclui comentários,
  linhas em branco; ignora `.md`) para extensões `.ts/.tsx/.js/.jsx/.rs/.css/.scss`; falha se > 300.
  Acionado como (a) **hook do Claude Code** (PostToolUse em Edit/Write) e (b) **git pre-commit**.
- **Rationale**: Princípio III/V — automatizar em vez de confiar em disciplina.
- **Alternativas**: lint rule (eslint `max-lines` só cobre JS/TS, não Rust; usar como reforço); revisão
  manual (regride). Decisão: script único multi-linguagem + eslint `max-lines` como reforço no front.

## D8 — Skills de aprendizado e ADRs

- **Decisão**: decisões relevantes viram **ADRs** (MADR) em `docs/adr/`. Erros recorrentes resolvidos
  viram **skills** em `.claude/skills/` (ex.: "não usar float para dinheiro", "entidade ORM não entra no
  domínio", "todo arquivo de lógica ≤300 linhas").
- **Rationale**: Princípio V; transforma correção em prevenção.

## D9 — Busca sem acento e roteamento

- **Decisão**: normalização de busca por coluna **derivada** (texto sem acento, minúsculo) gravada no
  banco para o `LIKE`/match rápido, computada na escrita do livro. Roteamento UI com `react-router`
  (rotas `/`, `/venda`, `/cadastro`, `/pesquisa`, `/relatorios`).
- **Rationale**: FR-021/SC-003; coluna normalizada evita varredura cara e mantém o domínio simples.
- **Alternativas**: `unaccent`/extensões (legado Postgres usava; indisponível em SQLite padrão sem
  extensão — rejeitado por dependência extra); normalizar em memória a cada busca (ok para ~500–5k itens,
  mantido como fallback).

## D10 — Autenticação de relatórios (gate simples)

- **Decisão**: gate local por usuário/senha (tabela `usuario` migrada; senha com hash). Sem gestão de
  múltiplos perfis na v1 (fora de escopo, spec Assumptions).
- **Rationale**: contexto de balcão de igreja; KISS. Migrar 5 usuários do legado; **rehash** senhas no
  primeiro uso, pois o legado guarda senha em texto.
- **Alternativas**: auth completa/OAuth (overkill — YAGNI).

---

### Resumo das decisões → ADRs

| ADR | Tema | Decisão |
|---|---|---|
| ADR-0001 | Persistência | SQLite local (arquivo em app_data_dir) |
| ADR-0002 | Núcleo & arquitetura | Domínio Rust, Hexagonal/SOLID, UI React adapter |
| ADR-0003 | ORM / camada de dados | SeaORM no adapter; entidades fora do domínio |
| ADR-0004 | Migrations | sea-orm-migration por comando, idempotentes |
| ADR-0005 | Dinheiro | Inteiro em centavos (i64) |
| ADR-0006 | Import legado | mdbtools + upsert idempotente, reconstrução normalizada |
| ADR-0007 | Guardrails | Hook/pre-commit de 300 linhas; skills; ADRs |
