# Architecture Decision Records (ADRs)

Registro versionado das decisões de arquitetura (Constituição, Princípio V). Formato leve (MADR).
As decisões nascem do `/speckit-plan` (ver `specs/001-sistema-estoque-vendas/research.md`).

| ADR | Título | Status |
|---|---|---|
| [0001](0001-persistencia-sqlite.md) | Persistência em SQLite local | Aceito |
| [0002](0002-nucleo-rust-hexagonal.md) | Núcleo de domínio em Rust + Hexagonal/SOLID | Aceito |
| [0003](0003-orm-seaorm.md) | ORM SeaORM na camada de dados | Aceito |
| [0004](0004-migrations-idempotentes.md) | Migrations por comando, idempotentes | Aceito |
| [0005](0005-dinheiro-em-centavos.md) | Dinheiro como inteiro em centavos | Aceito |
| [0006](0006-import-legado-idempotente.md) | Import do legado Access via mdbtools (upsert) | Aceito |
| [0007](0007-guardrails-hooks-skills.md) | Guardrails: hook de 300 linhas, skills, ADRs | Aceito |

**Versionamento**: um arquivo por decisão, numeração sequencial. Mudança de decisão → novo ADR que
"supersedes" o anterior (não reescrever o histórico).
