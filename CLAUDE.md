<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/004-inventario-melhorias/plan.md`
(base features: `specs/001-sistema-estoque-vendas/plan.md`, `specs/002-estoque-movimentos-inventario/plan.md`, `specs/003-fornecedores-lancamento-notas/plan.md`)

Project guardrails live in `.specify/memory/constitution.md` (v1.0.0): Hexagonal/SOLID Rust core,
KISS/DRY, ≤300 significant lines per logic file, idempotent migrations via command, money as integer
cents, hooks+skills+ADRs. Architecture decisions: `docs/adr/`. Feature spec:
`specs/004-inventario-melhorias/spec.md`.
<!-- SPECKIT END -->
