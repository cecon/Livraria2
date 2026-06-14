# ADR-0002 — Núcleo de domínio em Rust + Hexagonal/SOLID

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
Constituição (Princípio I) exige domínio isolado, testável sem UI nem banco, com ports & adapters. Stack
é Tauri 2 (Rust core + WebView React).

## Decisão
O **domínio e os casos de uso vivem em Rust** (`src-tauri/src/domain`, `application`). Toda I/O é uma
**porta** (trait) implementada por **adapter** na borda. Os **comandos Tauri** são a porta de entrada; a
**UI React** é adapter de UI e consome via `invoke`. Regra de dependência aponta para dentro.

## Consequências
- (+) Regras testáveis por `cargo test` sem UI/banco; um só lugar de verdade (DRY).
- (+) Troca de UI/persistência sem reescrever o núcleo.
- (−) Serialização DTO na fronteira Tauri (custo pequeno e explícito).

## Alternativas
Domínio em TypeScript com `tauri-plugin-sql` (regras acopladas ao React — rejeitado). Híbrido (duplicação
de regras — fere DRY).
