<!--
SYNC IMPACT REPORT
==================
Version change: (template inicial, não versionado) → 1.0.0
Bump rationale: Ratificação inicial da constituição (MAJOR 1.0.0) — primeira definição
concreta de princípios e governança a partir dos placeholders do template.

Modified principles: N/A (todos os princípios são novos)
Added principles:
  - I. Arquitetura Hexagonal & SOLID (Domínio Isolado)
  - II. Simplicidade Deliberada (KISS & DRY, YAGNI)
  - III. Limite de 300 Linhas por Arquivo de Lógica (NÃO-NEGOCIÁVEL)
  - IV. Persistência Idempotente via Comando (SQLite & Migrations)
  - V. Guardrails Automatizados (Hooks, Skills & ADRs)
  - VI. Fidelidade ao Domínio & Localização pt-BR
Added sections:
  - Restrições Técnicas & Stack
  - Fluxo de Desenvolvimento & Quality Gates
Removed sections: nenhuma (apenas placeholders substituídos)

Templates de dependência:
  - .specify/templates/plan-template.md ........ ✅ alinhado (Constitution Check é genérico; puxa os gates daqui)
  - .specify/templates/spec-template.md ......... ✅ alinhado (sem referência rígida que conflite)
  - .specify/templates/tasks-template.md ........ ✅ alinhado (categorização de tarefas compatível)
  - .specify/templates/checklist-template.md .... ✅ alinhado
  - .specify/templates/constitution-template.md . ℹ️ é o template fonte; não alterado

Follow-up TODOs: nenhum (sem placeholders deferidos).
-->

# Constituição da Livraria 2 (Espaço do Livro)

Este documento define os princípios **não-negociáveis** que governam a evolução do código da Livraria 2.
Ele tem precedência sobre conveniências pontuais. Conflitos entre uma decisão de implementação e esta
constituição resolvem-se a favor da constituição — ou exigem emenda formal (ver Governança).

## Princípios Fundamentais

### I. Arquitetura Hexagonal & SOLID (Domínio Isolado)

O sistema MUST seguir arquitetura **Hexagonal (ports & adapters)** sob os princípios **SOLID**:

- O **domínio** (regras de negócio: venda, estoque, pedido, relatórios) MUST ser código puro, sem
  importar UI, framework, banco, sistema de arquivos ou bibliotecas de I/O.
- Toda dependência externa (SQLite, leitor do `.mdb` legado, relógio, impressão, UI) MUST ser acessada
  por **portas** (interfaces) e implementada por **adapters** na borda. As dependências apontam **para
  dentro**: domínio ← aplicação ← adapters.
- As regras de negócio MUST ser testáveis **sem UI e sem banco** (com fakes/in-memory das portas).
- Cada unidade MUST ter responsabilidade única; abstrações MUST depender de interfaces, não de
  implementações concretas.

**Rationale**: o sistema sobrevive a trocas de UI, de mecanismo de persistência e à migração do legado
sem reescrever o núcleo. Evita o acoplamento que inviabilizou a tentativa anterior.

### II. Simplicidade Deliberada (KISS & DRY, YAGNI)

A solução MUST ser a mais simples que resolve o problema real.

- **KISS**: preferir o óbvio ao engenhoso. Nenhuma camada, padrão ou dependência entra sem necessidade
  demonstrada no escopo atual.
- **DRY**: conhecimento de negócio MUST ter uma única fonte de verdade; duplicação de regra é proibida
  (duplicação acidental de forma trivial é tolerável até virar regra).
- **YAGNI**: não construir para requisitos hipotéticos. Generalização especulativa MUST ser rejeitada.

**Rationale**: lição direta do legado abandonado (Next.js + Prisma + Postgres + pgvector/embeddings para
uma livraria de igreja de balcão). Complexidade não justificada é dívida, não ativo.

### III. Limite de 300 Linhas por Arquivo de Lógica (NÃO-NEGOCIÁVEL)

Todo arquivo de **arquitetura/lógica** MUST ter no máximo **300 linhas significativas**.

- **Escopo**: `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.css`, `.scss` e equivalentes de lógica/estilo.
- **Linhas significativas**: exclui comentários, linhas em branco e arquivos de documentação (`.md`).
- Ao se aproximar do limite, o arquivo MUST ser refatorado (extrair módulo, separar responsabilidade) —
  **nunca** comprimir código para burlar a contagem.
- O limite é verificado por **hook automático** (ver Princípio V); exceções pontuais MUST ser explícitas
  e justificadas via ADR, jamais silenciosas.

**Rationale**: arquivos pequenos forçam responsabilidade única, facilitam revisão e teste, e refletem
KISS/SOLID na prática.

### IV. Persistência Idempotente via Comando (SQLite & Migrations)

A persistência é **SQLite local** e toda evolução de esquema/dados MUST ser idempotente e por comando.

- Mudanças de esquema MUST ser feitas por **migrations geradas e aplicadas por comando** — nunca por
  alteração manual do banco.
- Migrations e a inicialização do esquema MUST ser **idempotentes**: re-aplicar em base nova ou já
  migrada produz o mesmo estado, sem erro, sem duplicar efeitos e sem perder dados.
- A **importação do legado** (Access `../Livraria/livraria.mdb`) MUST ser idempotente e re-executável
  como **upsert** por chave estável (código de barras para livros; número do pedido para vendas),
  preservando o que foi criado no novo sistema (ver spec `001-sistema-estoque-vendas`).

**Rationale**: durante a transição os dois sistemas convivem; reproveniência segura exige idempotência.

### V. Guardrails Automatizados (Hooks, Skills & ADRs)

As filosofias desta constituição MUST ser protegidas por automação, não por disciplina manual.

- **Hooks** automáticos MUST sinalizar/bloquear violações no momento da alteração (mínimo: limite de 300
  linhas; e demais verificações viáveis de KISS/DRY/camadas).
- Erros e decisões recorrentes resolvidos MUST ser capturados como **skills** reutilizáveis, para não se
  repetirem.
- Toda decisão de arquitetura relevante MUST ser registrada como **ADR** versionado (contexto, decisão,
  consequências) em `docs/adr/`.

**Rationale**: o que não é automatizado regride. Guardrails preservam a qualidade ao longo do tempo e
transformam erros em aprendizado institucional.

### VI. Fidelidade ao Domínio & Localização pt-BR

O sistema MUST preservar o modelo mental e o vocabulário dos usuários atuais.

- Termos e regras do negócio MUST ser mantidos exatamente: "Ministério", "Vale Presente", "Turma da
  Manhã/Tarde", "Pedido Nº", enum de categorias 0–6 ("0 = Não Categorizado"), turno por horário, baixa de
  estoque na venda, número de pedido sequencial contínuo.
- Idioma, moeda e datas MUST ser **pt-BR** (ex.: `R$ 1.234,56`); buscas MUST ser insensíveis a acento e
  caixa.
- O protótipo em `docs/design-handoff/` é a referência de alta fidelidade de aparência e comportamento.

**Rationale**: o objetivo é modernizar sem causar estranheza a voluntários; mudar termos quebra a adoção.

## Restrições Técnicas & Stack

- **Shell desktop**: Tauri 2. **UI**: React + TypeScript + shadcn/ui + Tailwind. **Núcleo/adapters de
  sistema**: Rust quando apropriado. **Dados**: SQLite local. Sem backend HTTP; funcionamento offline.
- **Camadas** (Hexagonal): domínio (regras puras) → aplicação (casos de uso/portas) → adapters
  (persistência SQLite, importador do `.mdb`, UI, impressão). A regra de dependência aponta para dentro.
- **ADRs** ficam em `docs/adr/`. No mínimo: persistência SQLite; camada de dados/ORM; estratégia de
  migrations; Hexagonal/SOLID; limite de 300 linhas; hooks+skills; ETL/mapeamento do legado.
- Decisões de tecnologia que afetem estes pontos MUST passar por ADR antes da implementação.

## Fluxo de Desenvolvimento & Quality Gates

- O desenvolvimento segue **Spec-Driven Development** via Spec Kit: `specify → clarify → plan → tasks →
  implement`. O `plan` MUST validar o design contra esta constituição (Constitution Check).
- **Quality gates** antes de integrar mudança:
  1. Hooks de guardrail passam (limite de 300 linhas e demais verificações).
  2. Regras de domínio cobertas por testes que rodam sem UI nem banco.
  3. Toda nova decisão arquitetural possui ADR.
  4. Migrations/import permanecem idempotentes (re-execução não quebra nem duplica).
- Violar um princípio MUST ser justificado por escrito (ADR) ou corrigido — nunca ignorado em silêncio.

## Governança

- Esta constituição **tem precedência** sobre práticas e conveniências pontuais.
- **Emendas**: requerem (a) descrição da mudança e motivo, (b) atualização deste arquivo com incremento de
  versão, (c) propagação para os templates/artefatos dependentes afetados.
- **Versionamento** (semântico): MAJOR = remoção/redefinição incompatível de princípio ou governança;
  MINOR = novo princípio/seção ou expansão material de orientação; PATCH = esclarecimentos e ajustes não
  semânticos.
- **Conformidade**: revisões de código e o Constitution Check do `plan` MUST verificar aderência.
  Complexidade adicional MUST ser justificada. Hooks automatizam a verificação sempre que possível.
- Esta constituição reside em `.specify/memory/constitution.md` e é a fonte de orientação de runtime para
  o agente e para os colaboradores.

**Version**: 1.0.0 | **Ratified**: 2026-06-14 | **Last Amended**: 2026-06-14
