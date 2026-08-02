# Specification Quality Checklist: PDV — venda vinculada a turno, sync só-sobe e retenção de 45 dias

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Referências técnicas confinadas a Dependências**: os nomes `estoque_status`, `sincronizado_em` e
  `ORDEM_DEPENDENCIA` aparecem **apenas** na seção Dependencies/Assumptions, como contexto de integração
  com o sistema atual (em especial a reconciliação com o fix de saldo operacional v26.8.3). As histórias,
  FRs e SCs permanecem agnósticas de implementação. Aceito como exceção deliberada porque a conexão com o
  código já em produção é informação essencial para o `/speckit-plan`.
- **Clarify (sessão 2026-08-01) — forks resolvidos**: cancelamento só do turno aberto (venda de turno
  fechado não é cancelável no PDV); poda por turno inteiro; turno padrão global; + decisões do usuário:
  numeração reinicia por turno, identidade do turno inclui a máquina, um único turno aberto por PDV,
  poda só local (nuvem retém tudo), escritório enxerga todos os turnos. Ver seção `## Clarifications`.
- **Ponto de atenção para o plano**: FR-006 + a dependência do fix de saldo operacional seguem como o
  principal risco técnico — o sinal "venda já incorporada" precisa passar de *puxado da nuvem* para
  *local* (push-only). Também: número de venda deixa de ser único global (usar turno + número).
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
