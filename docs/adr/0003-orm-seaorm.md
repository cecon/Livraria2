# ADR-0003 — ORM SeaORM na camada de dados

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
Requisito explícito de usar um **ORM** (spec FR-070). O núcleo é Rust async (tokio, via Tauri) e o
domínio MUST permanecer livre de detalhes de persistência ([ADR-0002](0002-nucleo-rust-hexagonal.md)).

## Decisão
Usar **SeaORM** (com `sqlx-sqlite`, runtime tokio) **apenas no adapter de persistência**. As entidades
SeaORM ficam fora do domínio; os repositórios implementam as portas (`LivroRepo`, `PedidoRepo`) e
convertem entidade ↔ tipo de domínio. Uma entidade por arquivo (limite de 300 linhas).

## Consequências
- (+) ORM idiomático async; migrations programáticas → [ADR-0004](0004-migrations-idempotentes.md).
- (+) Domínio limpo; entidade nunca cruza a fronteira do domínio (vira skill de revisão).
- (−) Curva do SeaORM; mapeamento entidade↔domínio é código extra (aceito pelo isolamento).

## Alternativas
Diesel (síncrono, `schema.rs` cresce — rejeitado por async). sqlx puro (não é ORM). rusqlite (manual).
