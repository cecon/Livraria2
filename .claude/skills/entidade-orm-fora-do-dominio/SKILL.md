---
name: entidade-orm-fora-do-dominio
description: Ao escrever código Rust deste projeto, mantenha o domínio puro — nada de SeaORM/Tauri/sqlx em src-tauri/src/domain. Use ao criar entidades, repositórios, casos de uso ou ao decidir onde colocar um tipo novo.
---

# Domínio puro — ORM fica no adapter (Hexagonal)

**Regra (ADR-0002/0003):** `src-tauri/src/domain/` é **código puro** — proibido importar `sea_orm`,
`sea_orm_migration`, `sqlx`, `tauri`. As entidades SeaORM (`adapters/persistencia/entities/`) e os
detalhes de I/O vivem nos **adapters**, atrás de **portas** (traits em `application/ports.rs`).

## Como aplicar
- Tipo de negócio (Livro, Pedido, Dinheiro, Categoria…) → `domain/`, sem dependências de infra.
- Persistência → `adapters/persistencia/` (entidade SeaORM + `impl SomeRepo`), convertendo
  entidade ↔ tipo de domínio (`para_dominio`).
- Caso de uso → `application/` recebe `&dyn SomeRepo` (porta), nunca um tipo concreto de ORM.
- Regra de dependência: domínio ← aplicação ← adapters. As setas apontam para **dentro**.
- Verificação automática: `scripts/check-domain-purity.sh` falha se o domínio importar infra.

## Erro a evitar
Não fazer o caso de uso/domínio depender de `DatabaseConnection` ou de uma entidade SeaORM. Se precisar
de dados, adicione um método na porta (trait) e implemente no adapter.
