# Quickstart — Validação ponta a ponta (006)

Guia de validação manual dos cenários da spec. Referências: [data-model.md](data-model.md),
[contracts/tauri-commands.md](contracts/tauri-commands.md).

## Pré-requisitos

```bash
npm install            # npm-only (não usar pnpm)
npm run tauri dev      # aplica m007 no boot (idempotente)
cargo test --manifest-path src-tauri/Cargo.toml   # domínio + repos verdes
```

Base de teste: usar uma cópia de `livraria.db` (nunca a de produção). Re-abrir o app duas
vezes valida a idempotência da m007 (sem erro, sem seed duplicado de "Custos").

## Cenário 1 — Cadastro (US3)

1. Abrir a tela **Destinações**: deve existir apenas **Custos** (fixa, sem excluir/desativar/arrastar).
2. Criar **Missões** e **Espaço**. Tentar criar " missões " → bloqueado (nome duplicado normalizado).
3. Reordenar Espaço acima de Missões → ordem persiste ao reabrir a tela.

## Cenário 2 — Doação com rateio (US1, o caso dos 220)

1. Lançamentos → Nova nota → **Doação**; doador "Ana Souza (autora)".
2. Bipar um livro com qtd **220**; abrir o rateio do item: **10 Custos / 210 Missões**.
   - Conferir validação: rateio somando ≠ 220 impede finalizar com mensagem clara.
3. **Dar entrada** e conferir:
   - Estoque do livro subiu 220; extrato mostra `entrada` a custo R$ 0,00 (custo médio caiu).
   - `destinacao_saldo` do livro: Missões = 210 (livre = anterior + 10).
4. Cancelar a nota (antes de qualquer venda) → estoque e carimbo voltam ao estado anterior.
   Relançar a nota para os próximos cenários.

## Cenário 3 — Rateio percentual (metade/metade)

1. Nova nota Doação com padrão **50% Missões / 50% Espaço**; item de **41** unidades.
2. Conferir prefill: 21 Missões / 20 Espaço (sobra à primeira do rateio); ajustar manualmente
   e confirmar que o ajuste prevalece. Dar entrada.

## Cenário 4 — Venda na fronteira (US2 — badge só no detalhe)

Preparação: livro com saldo livre 1 e carimbo Missões 210 (cenário 2 com estoque inicial 1... 
ou ajustar para o estado desejado). Preço R$ 50,00.

1. PDV: vender **2 unidades** — o carrinho mostra **uma linha** ("2×"), nenhum passo novo (SC-002).
2. Detalhe da venda (Lista de vendas): item exibe **1 un. Custos · 1 un. Missões**, R$ 50,00 cada.
3. `destinacao_saldo`: Missões caiu para 209; estoque físico caiu 2.
4. **Cancelar a venda**: estoque +2 e Missões volta a 210 (devolução pelo registro de alocação).

## Cenário 5 — Relatório do período (US2)

1. Registrar mais 2 vendas: uma só de livro sem carimbo, outra consumindo Espaço.
2. Relatórios → **Por destinação**, intervalo de hoje:
   - Linhas: Custos, Missões, Espaço com qtd e R$; **Σ linhas = total vendido do dia** (SC-003).
   - Cancelar uma das vendas e reconferir: relatório reflete o estorno.

## Cenário 6 — Inventário protege carimbos

1. Livro com livre 5 + Missões 10 (estoque 15). Contagem/inventário: contar **12** (−3).
2. Conferir: livre caiu para 2, Missões **continua 10**.
3. Contar **1** (−11 adicional): livre 0, Missões cai para 1 (consumo na ordem após o livre).
4. Ajuste positivo +4: entra como livre (Missões inalterada).

## Cenário 7 — Destinar estoque existente (US4)

1. Escolher um livro **já em estoque** (ex.: 80 unidades, tudo livre — nenhuma doação).
2. No livro (Pesquisa → detalhe), abrir **Destino do estoque**: mostra Livre 80.
3. Transferir **50 de Livre → Missões**, motivo "doação da autora sobre estoque existente":
   - Estoque físico continua 80 (extrato do razão sem movimento novo); Livre 30, Missões 50.
   - Histórico do livro mostra a transferência (de → para, qtd, motivo, data).
4. Transferir 10 de Missões → Livre (correção): Livre 40, Missões 40.
5. Tentar transferir 100 de Livre (só há 40) → bloqueado com o disponível na mensagem.
6. Vender 45 unidades: consome 40 do livre e 5 de Missões (ordem preservada — o carimbo
   criado por transferência se comporta igual ao criado por nota).

## Cenário 8 — Guards

- Excluir "Missões" com saldo/alocação → bloqueado, oferece desativar.
- Desativar "Espaço" → some das opções de nova doação; vendas continuam consumindo seu carimbo
  e o relatório continua exibindo a linha.
- Cancelar a nota do cenário 2 **depois** da venda do cenário 4 → bloqueado
  (`carimbo_consumido`), mensagem clara.

## Regressão (nada mudou onde não devia)

- Nota de **Compra**: fluxo idêntico ao da 005 (fornecedor, custo, finalizar, cancelar).
- PDV: pagamento, troco e fechamento idênticos; `registrar_venda` com o mesmo payload.
- Relatórios existentes (vendas por forma) inalterados.
- `bash scripts/check-file-size.sh` (hook) — nenhum arquivo > 300 linhas significativas.
