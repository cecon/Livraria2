---
name: limite-300-linhas
description: Neste projeto, nenhum arquivo de lógica (.ts/.tsx/.js/.jsx/.rs/.css/.scss) pode passar de 300 linhas significativas. Use ao criar ou crescer um arquivo, ao decidir extrair um módulo/componente, ou quando o guardrail (scripts/check-file-size.sh) acusar violação.
---

# Limite de 300 linhas significativas por arquivo de lógica

**Regra (Constituição, Princípio III / ADR-0007):** arquivos `.ts/.tsx/.js/.jsx/.rs/.css/.scss` têm no
máximo **300 linhas significativas** (exclui comentários, linhas em branco e `.md`). Verificado por
`scripts/check-file-size.sh` (hook PostToolUse do Claude + git pre-commit).

## Como aplicar
- Ao se aproximar do limite, **refatore**: extraia um módulo Rust, um componente React, um helper.
  Exemplos no projeto: `Venda.tsx` extrai `PaymentRow`; `Relatorios.tsx` extrai `RelatoriosViews`;
  `pedido_repo.rs` extrai `inserir_cabecalho_e_itens`.
- **Nunca** comprima código (juntar linhas, remover quebras) para burlar a contagem — isso fere a
  intenção (responsabilidade única, legibilidade).
- Exceção pontual só com justificativa por ADR — jamais silenciosa.

## Erro a evitar
Deixar um componente/serviço virar um "deus-arquivo". Se um arquivo faz muitas coisas, ele provavelmente
viola SRP antes mesmo de violar as 300 linhas — quebre por responsabilidade.
