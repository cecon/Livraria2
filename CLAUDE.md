<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/007-sincronizacao-nuvem/plan.md`
(base features: `specs/001-sistema-estoque-vendas/plan.md`, `specs/002-estoque-movimentos-inventario/plan.md`, `specs/003-fornecedores-lancamento-notas/plan.md`, `specs/004-inventario-melhorias/plan.md`, `specs/005-formas-pagamento/plan.md`, `specs/006-destinacao-doacoes/plan.md`)

Project guardrails live in `.specify/memory/constitution.md` (v1.1.0): Hexagonal/SOLID Rust core,
KISS/DRY, ≤300 significant lines per logic file, idempotent migrations via command, money as integer
cents, hooks+skills+ADRs. Architecture decisions: `docs/adr/`. Feature spec:
`specs/007-sincronizacao-nuvem/spec.md`.
<!-- SPECKIT END -->

## Memória do projeto (segredos & longa duração)

Segredos e informações sensíveis de longa duração (senhas, credenciais, IDs de serviço) ficam na
página do Notion — **nunca** neste repositório:
[Memoria_Projeto_Livraria](https://app.notion.com/p/Memoria_Projeto_Livraria-3a30fcc132cf8068ab0dee09d80f9b76).
Nunca copie segredos para código, README, specs ou memórias locais — registre e consulte no Notion.
