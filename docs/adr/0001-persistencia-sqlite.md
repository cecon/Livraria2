# ADR-0001 — Persistência em SQLite local

**Status**: Aceito · **Data**: 2026-06-14 · **Decisores**: time Livraria 2

## Contexto
App desktop de balcão, offline, mono-estação, sem backend HTTP. ~503 livros + ~5.109 vendas históricas.
A constituição exige simplicidade (KISS) e funcionamento offline.

## Decisão
Usar **SQLite** local como único mecanismo de persistência, em arquivo no `app_data_dir` do Tauri.

## Consequências
- (+) Zero infraestrutura, offline, backup = copiar 1 arquivo.
- (+) Suficiente para a escala (milhares de registros).
- (−) Sem concorrência multi-máquina (não é requisito).
- Reconciliação financeira exige cuidado com tipos numéricos → ver [ADR-0005](0005-dinheiro-em-centavos.md).

## Alternativas
Postgres/Docker (a tentativa legada; complexidade injustificada — rejeitado). Arquivos JSON (sem
integridade/consultas — rejeitado).
