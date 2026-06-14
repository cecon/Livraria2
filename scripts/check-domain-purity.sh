#!/usr/bin/env bash
#
# Guardrail Hexagonal (Constituição, Princípio I / ADR-0002):
# o domínio (src-tauri/src/domain) é PURO — não pode importar infraestrutura.
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DOMINIO="$ROOT/src-tauri/src/domain"

if [ ! -d "$DOMINIO" ]; then
  exit 0
fi

# Importações proibidas no domínio (UI, ORM, banco, I/O de framework).
if grep -rnE 'use (sea_orm|sea_orm_migration|sqlx|tauri|csv)\b' "$DOMINIO" 2>/dev/null; then
  echo "" >&2
  echo "✗ O domínio importa infraestrutura acima (viola Hexagonal/ADR-0002)." >&2
  echo "  Mova o detalhe para um adapter e exponha uma porta (trait)." >&2
  exit 1
fi

echo "✓ domínio puro (sem sea_orm/tauri/sqlx/csv)"
