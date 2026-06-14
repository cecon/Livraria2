#!/usr/bin/env bash
#
# Guardrail da Constituição (Princípio III / ADR-0007):
# nenhum arquivo de arquitetura/lógica pode passar de 300 LINHAS SIGNIFICATIVAS.
# "Significativa" = não em branco e não puramente comentário. Arquivos .md são ignorados.
#
# Uso:
#   scripts/check-file-size.sh [arquivo ...]   # verifica os arquivos dados
#   scripts/check-file-size.sh                 # verifica todos os arquivos versionados elegíveis
#
# Sai com código 1 se algum arquivo exceder o limite.

set -euo pipefail

LIMIT="${MAX_SIGNIFICANT_LINES:-300}"
EXTS_RE='\.(ts|tsx|js|jsx|rs|css|scss)$'

# Conta linhas significativas de um arquivo (ignora linhas em branco e comentários
# de linha // # *  e blocos /* ... */ e <!-- ... -->).
count_significant() {
  awk '
    BEGIN { inblock = 0; n = 0 }
    {
      line = $0
      # remove espaços à esquerda/direita
      gsub(/^[ \t]+|[ \t]+$/, "", line)
      if (line == "") next

      if (inblock) {
        if (line ~ /\*\//) { inblock = 0 }
        next
      }
      # início de bloco /* ... (sem fechar na mesma linha)
      if (line ~ /^\/\*/ && line !~ /\*\//) { inblock = 1; next }
      # comentários de linha inteira
      if (line ~ /^\/\//) next        # //
      if (line ~ /^#/) next           # #
      if (line ~ /^\*/) next          # * (continuação de bloco JSDoc)
      if (line ~ /^\/\*.*\*\/$/) next # /* ... */ numa linha só
      if (line ~ /^<!--/ && line ~ /-->$/) next
      n++
    }
    END { print n }
  ' "$1"
}

# Monta a lista de arquivos a verificar.
files=()
if [ "$#" -gt 0 ]; then
  for f in "$@"; do
    [[ "$f" =~ $EXTS_RE ]] || continue
    [ -f "$f" ] || continue
    files+=("$f")
  done
else
  while IFS= read -r f; do
    [[ "$f" =~ $EXTS_RE ]] || continue
    [ -f "$f" ] || continue
    files+=("$f")
  done < <(git ls-files 2>/dev/null || true)
fi

status=0
for f in "${files[@]:-}"; do
  [ -z "${f:-}" ] && continue
  # ignora dependências/builds
  case "$f" in
    */node_modules/*|*/target/*|*/dist/*|src/components/ui/*) continue ;;
  esac
  n=$(count_significant "$f")
  if [ "$n" -gt "$LIMIT" ]; then
    echo "✗ $f: $n linhas significativas (limite $LIMIT)" >&2
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo "" >&2
  echo "Guardrail de 300 linhas violado (Constituição, Princípio III)." >&2
  echo "Refatore os arquivos acima — não comprima código para burlar a contagem." >&2
fi
exit "$status"
