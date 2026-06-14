# ADR-0004 — Migrations por comando, idempotentes

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
Constituição (Princípio IV) e spec (FR-061) exigem evolução de schema por **comando**, **idempotente**,
sem alteração manual do banco; transição com import recorrente.

## Decisão
Usar **`sea-orm-migration`** (migrations em Rust, uma por arquivo), aplicadas por comando
(`inicializar_dados` + na subida do app). O migrator rastreia o que já foi aplicado (`seaql_migrations`);
DDL usa `IF NOT EXISTS` onde cabível. Nenhuma edição manual de schema.

## Consequências
- (+) Re-aplicar em base nova/existente converge sem erro nem perda (SC-005).
- (+) Histórico de schema versionado e reproduzível.
- (−) Toda mudança de schema passa por código de migração (intencional).

## Alternativas
SQL solto manual (não idempotente — rejeitado). refinery (válido, mas o migrator do SeaORM já cobre).
