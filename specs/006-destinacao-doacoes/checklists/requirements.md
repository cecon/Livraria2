# Specification Quality Checklist: Destinação de estoque para doações

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-04
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

- Decisões acordadas em conversa e clarify (2026-07-04) já incorporadas: "Loja" como destinação padrão do sistema (saldo livre = resíduo da Loja), **carimbos com prioridade de venda sobre o livre** (Loja primeiro na ordem; a própria Loja é carimbável), **sem nota de doação** (entrada pelo lançamento normal; carimbos nascem só pela transferência "Destinar estoque"), perdas/estornos de entrada na ordem inversa (livre primeiro, protegendo carimbos), estorno de venda retroativo no relatório + janela de 5 dias para cancelar venda, seção "Posição atual" no relatório, PDV inalterado (uma linha por item, distribuição visível no detalhe da venda) + estados visuais (caixa livre, confirmação animada).
- O termo "razão de movimentos" nos FRs refere-se ao conceito de negócio já existente (histórico de movimentos de estoque), não a uma tecnologia.
