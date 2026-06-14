---
description: "Task list — Sistema de Estoque & Vendas (Livraria 2)"
---

# Tasks: Sistema de Estoque & Vendas — Livraria 2 (Espaço do Livro)

**Input**: Design documents from `specs/001-sistema-estoque-vendas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/tauri-commands.md](contracts/tauri-commands.md)

**Tests**: Testes de **domínio/aplicação** (puros, sem UI nem banco) são **obrigatórios** por exigência da
Constituição (Princípio I + Quality Gates), não opcionais. Testes de integração de adapters usam SQLite
temporário. Testes de UI ficam mínimos na v1.

**Arquitetura**: Hexagonal — domínio Rust puro ← aplicação (ports) ← adapters; UI React via `invoke`.
Dinheiro = inteiro em centavos (i64). Todo arquivo de lógica ≤ 300 linhas significativas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US6 (mapeia spec.md); `[MIG]` = Migração (FR-065..069); Setup/Foundational/Polish sem label

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Purpose**: dependências, esqueleto hexagonal e guardrails ativos desde o início.

- [X] T001 Adicionar dependências Rust em `src-tauri/Cargo.toml`: `sea-orm` (features sqlite + runtime-tokio-rustls + macros), `sea-orm-migration`, `tokio`, `serde`, `thiserror`, `tauri-plugin` conforme necessário
- [X] T002 [P] Adicionar `react-router-dom` ao frontend via npm (raiz)
- [X] T003 [P] Criar esqueleto hexagonal em `src-tauri/src/`: pastas+`mod.rs` para `domain/`, `application/`, `adapters/persistencia/entities/`, `adapters/legado/`, `migration/`
- [X] T004 [P] Criar pastas do frontend com placeholders: `src/routes/`, `src/components/`, `src/lib/`
- [X] T005 Criar guardrail `scripts/check-file-size.sh`: conta linhas significativas (exclui comentários, linhas em branco; ignora `.md`) para `.ts/.tsx/.js/.jsx/.rs/.css/.scss`; sai ≠ 0 se algum > 300 (ADR-0007)
- [X] T006 Acionar o guardrail: git pre-commit hook + hook do Claude Code (`.claude/settings.json` PostToolUse em Edit/Write) chamando `scripts/check-file-size.sh`
- [ ] T007 [P] Configurar reforço no front: regra eslint `max-lines` (300, sem comentários/blank) em `eslint.config`

**Checkpoint**: stack compila (`npm run build`, `cargo check`) e o guardrail está ativo.

---

## Phase 2: Foundational (Pré-requisitos bloqueantes)

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

### Domínio — primitivos puros (com testes)

- [X] T008 [P] Implementar `Dinheiro` (centavos i64): parse pt-BR (vírgula), format `R$`, soma/subtração, em `src-tauri/src/domain/dinheiro.rs` + testes unitários (ADR-0005)
- [X] T009 [P] Implementar enum `Categoria` (0–6) com conversão de inteiro/legado em `src-tauri/src/domain/categoria.rs` + testes
- [X] T010 [P] Implementar enums `FormaPagamento` (Cartão/Dinheiro/PIX/Ministério/Vale) e `Turno` (Manhã/Tarde) em `src-tauri/src/domain/pagamento.rs` + testes
- [X] T011 [P] Definir erros de domínio (`SEM_ITENS`, `PAGO_INSUFICIENTE`, `LIVRO_NAO_ENCONTRADO`, `CODIGO_INVALIDO`) em `src-tauri/src/domain/erros.rs`
- [X] T012 [P] Função `normalize()` (NFD, sem acento, minúsculo) para busca em `src-tauri/src/domain/texto.rs` + testes (FR-021)

### Aplicação — portas (traits)

- [X] T013 Definir portas em `src-tauri/src/application/ports.rs`: `LivroRepo`, `PedidoRepo`, `UsuarioRepo`, `Relogio`, `ImportadorLegado`, `Impressora` (depende de T008–T012)

### Persistência — conexão, migrations, entidades

- [X] T014 Configurar conexão SeaORM/SQLite (arquivo em `app_data_dir`) em `src-tauri/src/adapters/persistencia/mod.rs`
- [X] T015 Criar migrator `sea-orm-migration` com a 1ª migration (tabelas `livro`, `pedido`, `item_pedido`, `usuario`, índices) idempotente em `src-tauri/src/migration/` (ADR-0004, data-model.md)
- [X] T016 [P] Criar entidades SeaORM (um arquivo por tabela) em `src-tauri/src/adapters/persistencia/entities/` (`livro.rs`, `pedido.rs`, `item_pedido.rs`, `usuario.rs`)
- [X] T017 [P] Implementar adapter `Relogio` do sistema em `src-tauri/src/adapters/relogio.rs`

### Plumbing Tauri + Frontend base

- [X] T018 Esqueleto de comandos em `src-tauri/src/commands.rs` + wiring/DI dos adapters nas portas e `manage(state)` em `src-tauri/src/lib.rs`
- [X] T019 Comando `inicializar_dados` (roda o migrator idempotente) em `src-tauri/src/commands.rs` (FR-061)
- [X] T020 [P] Camada IPC do front: wrappers `invoke` em `src/lib/ipc.ts` e tipos espelhados em `src/lib/types.ts` (contracts/)
- [X] T021 [P] Utilidades de UI `BRL()`/`normalize()` em `src/lib/format.ts`
- [X] T022 Shell de navegação: `react-router` com rotas `/ /venda /cadastro /pesquisa /relatorios` + `AppSidebar` + tema claro/escuro em `src/App.tsx` e `src/components/AppSidebar.tsx` (FR-053)

**Checkpoint**: domínio testável por `cargo test` sem UI/banco; app abre com navegação e DB inicializado.

---

## Phase 3: User Story 1 - Registrar uma venda no PDV (Priority: P1) 🎯 MVP

**Goal**: registrar venda (escanear/buscar itens, pagamento, concluir), baixando estoque e gerando nº de pedido.

**Independent Test**: com 1 livro cadastrado, adicionar item, pagar ≥ total, concluir → pedido gravado,
estoque baixado, nº incrementado (quickstart cenário 3/4).

- [X] T023 [P] [US1] Modelar `Pedido`/`ItemPedido` (snapshot título/preço, somar qtd, qtd ≥ 1) em `src-tauri/src/domain/pedido.rs` + testes
- [X] T024 [P] [US1] Cálculo de pagamento (pago = Σ formas; restante = max(0,total−pago); troco) e derivação de turno em `src-tauri/src/domain/pedido.rs`/`pagamento.rs` + testes (FR-012)
- [X] T025 [US1] Implementar `PedidoRepo` (inserir pedido+itens em transação, baixar estoque por item piso 0, `MAX(numero)+1`) em `src-tauri/src/adapters/persistencia/pedido_repo.rs` (depende de T016)
- [X] T026 [US1] Caso de uso `registrar_venda` + `proximo_numero_pedido` (valida ≥1 item e pago ≥ total) em `src-tauri/src/application/venda.rs` + testes com repos fake (FR-014/015)
- [X] T027 [US1] Expor comandos `registrar_venda` e `proximo_numero_pedido` em `src-tauri/src/commands.rs` (contracts/)
- [X] T028 [US1] Teste de integração do `PedidoRepo` com SQLite temporário em `src-tauri/tests/pedido_repo.rs` (SC-002)
- [X] T029 [P] [US1] Tela PDV `src/routes/Venda.tsx`: entrada de código (autofocus, Enter), busca/dropdown, tabela de itens com stepper, foco pós-conclusão (FR-010/011/052)
- [X] T030 [P] [US1] Componentes `src/components/PaymentRow.tsx` (formas na ordem exata + "Receber restante") e resumo com Total/Pago/Troco (FR-013)

**Checkpoint**: US1 funciona ponta a ponta e é testável isoladamente (MVP).

---

## Phase 4: User Story 2 - Manter o cadastro de livros (Priority: P1)

**Goal**: incluir/alterar/excluir livro por código de barras (modo novo vs. edição).

**Independent Test**: código novo → form vazio; código existente → form preenchido; salvar → upsert;
aparece em "recentes" (quickstart cenário 5).

- [X] T031 [P] [US2] Validações de `Livro` (campos, categoria, estoque ≥ 0) e cálculo de `busca_norm` em `src-tauri/src/domain/livro.rs` + testes
- [X] T032 [US2] Implementar `LivroRepo` (upsert por código, `livros_recentes`, soft-delete) em `src-tauri/src/adapters/persistencia/livro_repo.rs` (data-model: soft-delete)
- [ ] T033 [US2] Caso de uso `cadastro` (incluir/alterar/excluir, lookup por código) em `src-tauri/src/application/cadastro.rs` + testes com repo fake (FR-001/002)
- [ ] T034 [US2] Expor comandos `livro_por_codigo`, `salvar_livro`, `excluir_livro`, `livros_recentes` em `src-tauri/src/commands.rs`
- [ ] T035 [US2] Teste de integração do `LivroRepo` (upsert idempotente, soft-delete) em `src-tauri/tests/livro_repo.rs`
- [ ] T036 [US2] Tela `src/routes/Cadastro.tsx`: lookup, form (Select de Categoria "id — nome", textarea), recentes, modo novo/edição (FR-003/004/005)

**Checkpoint**: US1 e US2 funcionam independentemente; já há acervo para vender.

---

## Phase 5: User Story 3 - Pesquisar o acervo e ver detalhes (Priority: P2)

**Goal**: consultar por código ou título/autor (sem acento) e ver detalhes.

**Independent Test**: `buscar_por_texto("biblia")` retorna "Bíblia"; 1 resultado abre detalhes; copiar código (quickstart cenário 6).

- [ ] T037 [US3] Caso de uso `pesquisa` (por código; por texto via `busca_norm`; 0/1/N resultados) em `src-tauri/src/application/pesquisa.rs` + testes (FR-020/021/022)
- [ ] T038 [US3] Query de busca no `LivroRepo` (LIKE sobre `busca_norm`, ordenação por relevância) em `src-tauri/src/adapters/persistencia/livro_repo.rs`
- [ ] T039 [US3] Expor comandos `buscar_por_codigo` e `buscar_por_texto` em `src-tauri/src/commands.rs`
- [ ] T040 [P] [US3] Tela `src/routes/Pesquisa.tsx`: duas buscas, grid de resultados, view de Detalhes com copiar código + toast (FR-023)
- [ ] T041 [P] [US3] Componentes reutilizáveis `src/components/StockBadge.tsx` e `src/components/Cover.tsx` (selo de estoque FR-051)

**Checkpoint**: US1–US3 operáveis isoladamente.

---

## Phase 6: User Story 4 - Visão do dia no Início (Priority: P2)

**Goal**: dashboard com indicadores do dia + estoque baixo + atalhos.

**Independent Test**: após vendas, `dashboard_do_dia` reflete vendas/itens/ticket e lista estoque baixo (quickstart cenário 7).

- [ ] T042 [US4] Caso de uso `dashboard` (agrega vendas do dia, itens, ticket médio, estoque baixo ≤3 + esgotados) em `src-tauri/src/application/dashboard.rs` + testes (FR-030)
- [ ] T043 [US4] Expor comando `dashboard_do_dia` em `src-tauri/src/commands.rs`
- [ ] T044 [P] [US4] Tela `src/routes/Inicio.tsx`: 4 stats, 4 atalhos, listas "Pedidos recentes" e "Estoque baixo" (esgotados primeiro) (FR-031)

**Checkpoint**: US1–US4 operáveis isoladamente.

---

## Phase 7: User Story 5 - Emitir relatórios e zerar o caixa (Priority: P2)

**Goal**: autenticar e emitir relatórios de venda/estoque; zerar caixa do turno.

**Independent Test**: `relatorio_vendas` reconcilia (Σ formas = Σ totais, R$ 0,00) (quickstart cenário 8).

- [ ] T045 [P] [US5] Implementar `UsuarioRepo` + verificação de senha (hash; rehash de legado em texto) em `src-tauri/src/adapters/persistencia/usuario_repo.rs` (ADR/D10)
- [ ] T046 [US5] Caso de uso `relatorios` (vendas dia/manhã/tarde com resumo por forma e subtotal Din+Cartão+PIX; estoque ordenado asc + valor total; zerar caixa) em `src-tauri/src/application/relatorios.rs` + testes de reconciliação (FR-041/042/043/044, SC-004)
- [ ] T047 [US5] Caso de uso `autenticar` em `src-tauri/src/application/relatorios.rs` (gate simples) (FR-040)
- [ ] T048 [US5] Expor comandos `autenticar`, `relatorio_vendas`, `relatorio_estoque`, `zerar_caixa` em `src-tauri/src/commands.rs`
- [ ] T049 [P] [US5] Tela `src/routes/Relatorios.tsx`: login (rádios de tipo, data, usuário/senha) + views de relatório com "Voltar"/"Imprimir" (`window.print`) (FR-045)

**Checkpoint**: US1–US5 operáveis isoladamente.

---

## Phase 8: Migração & Sincronização do Legado (FR-065..069) [MIG]

**Goal**: importar acervo + vendas do Access de forma idempotente (upsert), re-executável na transição.
Depende dos repositórios `LivroRepo` (US2) e `PedidoRepo` (US1).

**Independent Test**: rodar `migrar_legado` importa ~503 livros e ~5.109 vendas; re-rodar → 0 inserções
novas, sem duplicar (quickstart cenário 2, SC-009).

- [ ] T050 [MIG] Validar contra amostra real e fixar mapas `vdmetodo`→FormaPagamento e `vdturma`→Turno (default seguro) — registrar no `src-tauri/src/adapters/legado/mapeamentos.rs` (data-model)
- [ ] T051 [MIG] Adapter `ImportadorLegado` lendo `../Livraria/livraria.mdb` via `mdb-export` (subprocesso) + parse CSV em `src-tauri/src/adapters/legado/mdb_importer.rs` (ADR-0006)
- [ ] T052 [MIG] Caso de uso `migracao`: upsert de livros (categoria→enum 0–6; preço→centavos) e reconstrução normalizada de pedidos+itens (agrupar por nº, linha-resumo, split derivado de `vdmetodo`), preservando dados criados no novo sistema, em `src-tauri/src/application/migracao.rs` + testes (FR-066/067/067a/069a)
- [ ] T053 [MIG] Gerar `RelatorioMigracao` (inseridos/atualizados/descartados/divergências) e expor comando `migrar_legado` em `src-tauri/src/commands.rs`
- [ ] T054 [MIG] Teste de idempotência: rodar import 2× sobre SQLite temporário → sem duplicação; sequência de nº de pedido continua de MAX+1 (FR-068/069) em `src-tauri/tests/migracao.rs`

**Checkpoint**: dados reais disponíveis no novo sistema; re-sync seguro.

---

## Phase 9: User Story 6 - Guardrails de arquitetura (Priority: P2)

**Goal**: completar a automação que protege as filosofias (o script de 300 linhas e os ADRs já existem;
aqui ficam skills, reforços e verificação).

**Independent Test**: criar arquivo `.rs/.ts` > 300 linhas significativas → hook/pre-commit bloqueia (quickstart cenário 10, SC-006).

- [ ] T055 [P] [US6] Criar skills de prevenção em `.claude/skills/`: "dinheiro-em-centavos", "entidade-orm-fora-do-dominio", "limite-300-linhas" (Princípio V, ADR-0007)
- [ ] T056 [US6] Teste/verificação do guardrail: caso de arquivo > 300 linhas falha e ≤ 300 passa; documentar exceção-via-ADR
- [ ] T057 [P] [US6] Verificar que entidades SeaORM não são importadas pelo `domain/` (check simples no `scripts/` ou teste) — reforça ADR-0002/0003

**Checkpoint**: filosofias verificadas automaticamente.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T058 [P] Aplicar design tokens do handoff (escala `brand` verde, mono para preços/códigos) em `src/index.css` e componentes (docs/design-handoff)
- [ ] T059 [P] Folha de estilo de impressão para relatórios (`@media print`) em `src/`
- [ ] T060 Rodar validação do `quickstart.md` (cenários 1–10) ponta a ponta
- [ ] T061 [P] Atualizar `docs/` e `README.md` com comandos de migração e execução
- [ ] T062 Revisão final: termos pt-BR exatos (Ministério, Vale Presente, Turma da Manhã/Tarde, "Pedido Nº") e formatação R$ (FR-054)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → sem dependências.
- **Foundational (P2)** → depende do Setup; **bloqueia todas as user stories**.
- **US1 (P1, MVP)** e **US2 (P1)** → após Foundational. US1 e US2 independentes entre si.
- **US3, US4, US5 (P2)** → após Foundational; US4 e relatórios consomem dados de vendas (US1) para teste pleno, mas são implementáveis/testáveis isoladamente com dados semeados.
- **Migração [MIG]** → depende de `PedidoRepo` (US1/T025) e `LivroRepo` (US2/T032).
- **US6 Guardrails** → o núcleo (script + hook, T005/T006) já está no Setup; o restante é independente e pode rodar a qualquer momento.
- **Polish (P10)** → após as stories desejadas.

### Within Each Story

- Domínio (com testes) → repositório (adapter) → caso de uso (com testes) → comando Tauri → UI.
- Testes de domínio/aplicação MUST passar sem UI nem banco (Constituição).

### Parallel Opportunities

- Setup: T002, T003, T004, T007 em paralelo.
- Foundational: primitivos de domínio T008–T012 em paralelo; entidades T016 e relógio T017 em paralelo; IPC/format T020/T021 em paralelo.
- Por story, tarefas `[P]` (arquivos distintos) em paralelo — ex.: US1 T023/T024 (domínio) e T029/T030 (UI).
- Com equipe: após Foundational, US1 e US2 em paralelo (devs diferentes); US3/US4/US5 em seguida.

---

## Parallel Example: User Story 1

```bash
# Domínio (arquivos/áreas distintas) em paralelo:
Task: "T023 Modelar Pedido/ItemPedido em src-tauri/src/domain/pedido.rs"
Task: "T024 Cálculo de pagamento/turno em src-tauri/src/domain/pagamento.rs"
# UI em paralelo ao domínio:
Task: "T029 Tela PDV em src/routes/Venda.tsx"
Task: "T030 PaymentRow em src/components/PaymentRow.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (Venda) → **VALIDAR** isoladamente → demo.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 (Venda) → MVP. 3. US2 (Cadastro). 4. **Migração** (popular dados reais). 5. US3 Pesquisa. 6. US4
   Dashboard. 7. US5 Relatórios. 8. US6 Guardrails (reforços). 9. Polish.
   > Recomenda-se executar a **Migração logo após US1+US2** para validar com os ~503 livros e ~5.109 vendas reais.

### Notas

- `[P]` = arquivos diferentes, sem dependência pendente.
- Cada story é completável e testável de forma independente.
- Commit após cada tarefa ou grupo lógico; o guardrail de 300 linhas roda no pre-commit.
- Todo arquivo de lógica ≤ 300 linhas significativas; ao exceder, refatorar (não comprimir).
