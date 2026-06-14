# ADR-0007 — Guardrails: hook de 300 linhas, skills e ADRs

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
Constituição (Princípios III e V) exige proteger as filosofias por automação, não disciplina manual:
limite de 300 linhas significativas por arquivo de lógica, captura de aprendizados e registro de decisões.

## Decisão
- **Script `scripts/check-file-size`**: conta linhas significativas (exclui comentários, linhas em branco;
  ignora `.md`) para `.ts/.tsx/.js/.jsx/.rs/.css/.scss`; falha > 300. Acionado como **hook do Claude Code**
  (PostToolUse em Edit/Write) **e** **git pre-commit**. Reforço no front com eslint `max-lines`.
- **Skills** em `.claude/skills/` capturam erros recorrentes (ex.: "dinheiro nunca em float", "entidade ORM
  fora do domínio", "arquivo de lógica ≤ 300 linhas").
- **ADRs** em `docs/adr/` registram decisões; mudança → novo ADR que supersedes.

## Consequências
- (+) Filosofias verificadas automaticamente antes de entrar no histórico (SC-006).
- (+) Erros viram prevenção; decisões ficam rastreáveis.
- (−) Falsos positivos possíveis no contador → exceção só via ADR explícito, nunca silenciosa.

## Alternativas
Só revisão manual (regride — rejeitado). Só eslint (não cobre Rust — insuficiente).
