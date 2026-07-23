# Feature Specification: Operações de balcão na nuvem — Turno, Venda e Inventário

**Feature Branch**: `009-turno-venda-inventario`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Operações de balcão no Escritório (nuvem), fechando a paridade com o PDV — continuação da 008: turno de operação, venda completa e inventário na nuvem, reusando o domínio via WASM; + pendências da 008 (export de relatórios e testes)."

## Resumo

A feature 008 deixou o **Escritório (nuvem) idêntico ao PDV na retaguarda** (cadastro, pesquisa, lançamentos, fornecedores, formas, destinações, relatórios). Falta a parte **operacional de balcão**: registrar **vendas** e **inventário** pela nuvem, e o conceito que organiza tudo isso — o **turno de operação** (abrir caixa, vender, encerrar com fechamento).

Esta feature entrega essas operações **no Escritório**, com o **mesmo comportamento do PDV** (mesmas regras, via o domínio compartilhado em WASM), e fecha as pendências deixadas pela 008. Ao final, o Escritório opera de ponta a ponta como o PDV — muda só onde está aberto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turno de operação: abrir, vender dentro dele, encerrar (Priority: P1)

O operador **abre um turno** (ação explícita, com valor inicial de caixa opcional) antes de vender. Todas as vendas do expediente ficam **contidas no turno** e numeradas em sequência própria (Pedido Nº 1, 2, 3… dentro do turno). Ao final, ele **encerra o turno** e vê um **fechamento de caixa** (totais por forma de pagamento, quantidade de vendas, valor esperado vs. conferido). O mesmo conceito vale no PDV e no Escritório.

**Why this priority**: é o alicerce operacional e o que **resolve a numeração de pedidos com dois pontos de venda** (sem colisão entre origens). É **pré-requisito da Venda** — sem turno aberto não há venda.

**Independent Test**: abrir um turno, registrar vendas numeradas 1..n, encerrar e conferir o fechamento; validar que o turno converge entre PDV e Escritório pela sincronização.

**Acceptance Scenarios**:

1. **Given** nenhum turno aberto, **When** o operador tenta registrar uma venda, **Then** o sistema exige **abrir um turno** primeiro.
2. **Given** um turno aberto, **When** conclui vendas em sequência, **Then** cada venda recebe o **próximo Pedido Nº daquele turno** (1, 2, 3…), reiniciando em relação a outros turnos.
3. **Given** um turno com vendas, **When** o operador encerra, **Then** vê o **fechamento de caixa** (totais por forma, nº de vendas, esperado vs. conferido) e o turno **não aceita novas vendas**.
4. **Given** turnos abertos no PDV e no Escritório, **When** ambos sincronizam, **Then** convergem por identidade estável, **sem colisão** de numeração entre eles.

---

### User Story 2 - Venda completa (checkout) no Escritório (Priority: P2)

Dentro de um turno aberto, o operador monta o **carrinho**, escolhe **forma(s) de pagamento** e **conclui a venda pelo navegador** — com baixa de estoque, custo e troco calculados **pelas mesmas regras do PDV**. O resultado grava na nuvem e reflete no PDV pela sincronização.

**Why this priority**: é a operação de maior valor e a razão de existir do turno; depende dele (US1).

**Independent Test**: concluir uma venda no Escritório e conferir que estoque, custo, valores e troco batem com o que o PDV produziria para a mesma venda.

**Acceptance Scenarios**:

1. **Given** um carrinho com itens e uma forma de pagamento, **When** a venda é concluída, **Then** a venda é gravada, o estoque é baixado e custo/troco resultam **iguais ao PDV**.
2. **Given** uma baixa que excederia o estoque disponível, **When** concluída, **Then** a **mesma regra do PDV** é aplicada (limita/sinaliza), sem estoque negativo.
3. **Given** pagamento com troco, **When** concluída, **Then** o **troco** é calculado igual ao PDV (troco só de dinheiro; pago ≥ total).

---

### User Story 3 - Inventário: contagem física na nuvem (Priority: P3)

O operador realiza a **contagem de inventário** pelo Escritório (digitação e/ou câmera, sem leitor dedicado); ao finalizar, os **ajustes** resultantes são gravados na nuvem e o resumo confere com o que o PDV registraria.

**Why this priority**: importante para a operação, mas independente da venda; entra depois.

**Acceptance Scenarios**:

1. **Given** uma contagem no Escritório, **When** finalizada, **Then** itens e ajustes gravam na nuvem e conferem com a contagem equivalente do PDV.

---

### User Story 4 - Fechar pendências da retaguarda (008) (Priority: P3)

A retaguarda (008) ficou com duas pendências: **exportar relatórios** (Excel/PDF/WhatsApp) — hoje só Imprimir — e a **cobertura de testes** de ida-e-volta, acesso e concorrência. Esta história as conclui.

**Acceptance Scenarios**:

1. **Given** um relatório emitido, **When** o operador exporta, **Then** obtém Excel/PDF e/ou compartilha um resumo por WhatsApp, equivalente ao PDV.
2. **Given** operações de retaguarda, **When** rodam os testes, **Then** provam ida-e-volta PDV↔nuvem, regra de acesso e convergência concorrente.

---

### Edge Cases

- **Venda sem turno aberto**: bloquear e orientar a abrir um turno.
- **Turno esquecido aberto** (virada de dia): alerta / encerramento assistido — **nunca** encerrar em silêncio sem fechamento.
- **Divergência no fechamento**: valor conferido ≠ esperado — registrar a diferença, sem impedir o encerramento.
- **Dois turnos abertos pelo mesmo operador** (PDV e Escritório): permitido — cada turno é contexto próprio de numeração; converge por identidade estável.
- **Estoque insuficiente na venda**: baixa limitada ao saldo, sem negativo; `baixa < qtd` é sinalizado, não silencioso.
- **Câmera indisponível no inventário**: cair para digitação do código.
- **Sem conexão** no Escritório: operação online bloqueada com aviso claro (o PDV segue offline).

## Requirements *(mandatory)*

### Functional Requirements

#### Turno de operação (US1) — PDV e Escritório

- **FR-001**: O sistema MUST oferecer um **turno de operação** com ciclo **abrir → vender → encerrar**, vinculado ao **operador**; abertura por **ação explícita**, com **valor inicial de caixa** opcional.
- **FR-002**: Uma **venda só pode ser registrada dentro de um turno aberto**; toda venda MUST pertencer a um turno e ao operador do turno.
- **FR-003**: O **Pedido Nº** MUST ser **sequencial por turno** (1..n), reiniciando a cada turno; a identidade única real é estável (não colide entre PDV e Escritório).
- **FR-004**: O **encerramento** MUST exibir um **fechamento de caixa** (totais por forma de pagamento, qtd de vendas, **valor esperado vs. conferido**, registrando a diferença) e **fechar o turno** para novas vendas.
- **FR-005**: O turno MUST ser o **mesmo conceito no PDV e no Escritório**, convergindo entre as pontas pela sincronização, sem colisão de numeração entre turnos.

#### Venda no Escritório (US2)

- **FR-006**: O Escritório MUST permitir **concluir uma venda** (carrinho, formas de pagamento, baixa de estoque, custo, troco), **exigindo um turno aberto**.
- **FR-007**: A venda no Escritório MUST produzir o **mesmo resultado de negócio** que o PDV para a mesma entrada — mesma baixa (limitada ao saldo, sem negativo), mesmo custo, mesma validação de conclusão (pago ≥ total; troco só de dinheiro).
- **FR-008**: Quando a baixa for **menor que a quantidade** vendida (estoque insuficiente), o sistema MUST **sinalizar** (sem bloquear a venda e sem estoque negativo), como no PDV.

#### Inventário no Escritório (US3)

- **FR-009**: O Escritório MUST permitir **realizar a contagem física** por digitação e/ou câmera (sem leitor dedicado), gravando os **ajustes** resultantes; o resultado MUST conferir com a contagem equivalente do PDV.

#### Pendências da retaguarda (US4)

- **FR-010**: Os relatórios MUST permitir **exportar** para Excel e PDF e **compartilhar** um resumo por WhatsApp, equivalente ao PDV.
- **FR-011**: A feature MUST incluir **testes automatizados** cobrindo: ida-e-volta PDV↔nuvem, regra de acesso (autenticado), e convergência em edição concorrente.

#### Consistência e esquema

- **FR-012**: O turno MUST persistir nas duas pontas por **migração idempotente**: no SQLite local e na nuvem (próximos números disponíveis: **`m009`** local e **`0006_turno.sql`** na nuvem — `0004`/`0005` já usadas).
- **FR-013**: As regras de negócio (turno, clamp de baixa, validação de venda, custo, contagem) MUST vir do **domínio compartilhado** (uma fonte de verdade), sem reimplementação divergente entre PDV e Escritório.

### Key Entities

- **Turno de operação** *(novo)*: sessão de trabalho de um operador — abertura (data/hora, caixa inicial opcional), status (aberto/encerrado), sequência de Pedido Nº própria, encerramento (data/hora, resumo por forma, esperado vs. conferido). Distinto do `Turno` por horário (Manhã/Tarde). Converge entre PDV e Escritório.
- **Pedido / Venda / Pagamento**: passa a referenciar o **turno** e a ter **Pedido Nº por turno**.
- **Movimento de estoque**: a venda emite `saida_venda`; o inventário emite `ajuste`/contagem.
- **Inventário**: sessão de contagem e seus itens/ajustes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com turnos abertos simultaneamente no PDV e no Escritório, **0 colisões** de Pedido Nº entre origens; cada venda recebe o próximo número **dentro do seu turno**.
- **SC-002**: Ao encerrar um turno, o fechamento de caixa (totais por forma, esperado vs. conferido) confere com as vendas do turno em **100%** dos casos de teste.
- **SC-003**: Para um conjunto de vendas idênticas executadas nas duas pontas, **100% dos resultados** (estoque, custo, valores, troco) conferem.
- **SC-004**: Uma contagem de inventário feita no Escritório produz **os mesmos ajustes** que a equivalente no PDV em **100%** dos casos de teste.
- **SC-005**: A suíte de conformidade (regras do domínio, nativo vs. WASM) permanece **100% verde** para as funções de turno/venda/inventário.
- **SC-006**: Um relatório emitido no Escritório pode ser **exportado** (Excel/PDF) e compartilhado, com os **mesmos números** do PDV.

## Assumptions

- **Base pronta (008)**: o domínio Rust já é crate + WASM (`@livraria/domain` expõe `clamp_baixa_venda`, `validar_conclusao`, `contagem_efetiva`, custo médio); `@livraria/ui` e o workspace estão montados; o CI regenera o WASM. **ADR-0021** (turno) já registrado.
- **Offline do PDV invariante**: o turno/venda/inventário funcionam **offline no PDV** (SQLite local) e sincronizam; o Escritório é **online**.
- **Numeração offline-safe**: o Pedido Nº por turno é calculável sem alocador central (contexto por origem), preservando o offline do PDV.
- **Autenticação**: usa o login vigente do Escritório (usuário/senha da tabela `usuario` + sessão de serviço compartilhada — do PR #15); esta feature não redefine o modelo de acesso.
- **Fonte da verdade**: as regras vêm do domínio compartilhado; onde uma regra hoje mora no adapter do PDV, é elevada ao domínio para valer igual nas duas pontas.

## Dependencies

- **Feature 008** (retaguarda + fundação domínio/WASM/UI/workspace) — já na `main`.
- **Feature 007** (sincronização com a nuvem, esquema-espelho) — base do turno/venda/inventário.
- **Domínio compartilhado** (`livraria-domain` / `@livraria/domain`) como especificação do comportamento a espelhar.

## Decisões herdadas da 008 (clarify)

- **Turno**: abertura **explícita** (caixa inicial opcional); **Pedido Nº sequencial por turno**; **fechamento de caixa** no encerramento; **mesmo conceito no PDV e no Escritório**.
- **Venda**: **checkout completo** na nuvem (dentro de turno).
- **Inventário**: **contagem física na nuvem** (digitação/câmera).
