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
vezes valida a idempotência da m007 (sem erro, sem seed duplicado de "Loja").

## Cenário 1 — Cadastro (US3)

1. Abrir a tela **Destinações**: deve existir apenas **Loja** (fixa, sem excluir/desativar/arrastar).
2. Criar **Missões** e **Espaço**. Tentar criar " missões " → bloqueado (nome duplicado normalizado).
3. Reordenar Espaço acima de Missões → ordem persiste ao reabrir a tela.

## Cenário 2 — Doação em dois passos (o caso dos 220)

1. **Entrada normal**: Lançamentos → Nova nota (fluxo atual), item de **220 unidades a
   custo R$ 0,00**, finalizar. Extrato mostra `entrada` a custo zero (custo médio caiu).
2. **Destinar**: Pesquisa → livro → **Destinar estoque**: transferir **10 de Livre → Loja** e
   **210 de Livre → Missões** (motivo: "doação da autora").
3. Conferir: estoque físico inalterado (as transferências não mexem no físico); saldos
   Loja 10 / Missões 210; histórico do livro mostra as duas transferências.
4. Tentar transferir mais 100 de Livre (não há) → bloqueado com o disponível na mensagem.
5. Corrigir: 10 de Missões → Livre e de volta — saldos batem em cada passo.

## Cenário 3 — Venda na fronteira (US2 — badge só no detalhe)

Preparação: livro com carimbo **Loja 1** e **Missões 210** (livre 0). Preço R$ 50,00.

1. PDV: vender **2 unidades** — o carrinho mostra **uma linha** ("2×"), nenhum passo novo (SC-002).
2. Detalhe da venda (Lista de vendas): item exibe **1 un. Loja · 1 un. Missões**, R$ 50,00 cada
   (carimbos na ordem: Loja primeiro, depois Missões).
3. Saldos: Loja 0, Missões 209; estoque físico caiu 2.
4. **Cancelar a venda** (mesmo dia): estoque +2, Loja volta a 1 e Missões a 210 (devolução pelo
   registro de alocação — inclusive o carimbo Loja).

## Cenário 4 — Carimbo antes do livre

1. Livro com livre 40 e Missões 40 (via transferências). Vender **45 unidades**.
2. Conferir: consome os **40 de Missões primeiro** e 5 do livre; detalhe mostra 40 Missões +
   5 Loja.

## Cenário 5 — Relatório do período + posição atual (US2)

1. Registrar vendas variadas (com e sem carimbo, mais de um destino).
2. Relatórios → **Por destinação**, intervalo de hoje:
   - Linhas: Loja, Missões, Espaço com qtd e R$; **Σ linhas = total vendido do dia** (SC-003).
   - Seção **Posição atual**: unidades restantes por destinação (todos os livros), refletindo
     transferências e vendas até agora.
3. Cancelar uma venda de hoje e reconferir: o relatório do dia reflete o estorno (retroativo).

## Cenário 6 — Inventário e estornos protegem carimbos (ordem de perda)

1. Livro com livre 5 + Missões 10 (estoque 15). Contagem: contar **12** (−3).
2. Conferir: livre caiu para 2, Missões **continua 10**.
3. Contar **1** (−11 adicional): livre 0, Missões cai para 1 (consumo na ordem após o livre).
4. Ajuste positivo +4: entra como livre (Missões inalterada).
5. **Estorno de lançamento**: dar entrada de 10, carimbar 8 para Missões, cancelar a nota →
   estorno físico de 10 consome 2 do livre e 8 de Missões (regra de perda; sem erro).

## Cenário 7 — Guards

- Excluir "Missões" com saldo/alocação/transferência → bloqueado, oferece desativar.
- Desativar "Espaço" → some das opções de transferência (como destino); vendas continuam
  consumindo seu carimbo e o relatório continua exibindo a linha.
- **Cancelar venda com mais de 5 dias** → bloqueado (`venda_antiga`), mensagem clara.

## Cenário 8 — Caixa livre e confirmação no PDV (US4)

1. Abrir o PDV sem itens: a área de itens mostra o informe **"Caixa livre"** (não uma tabela vazia).
2. Bipar um item: o informe some e a venda aparece; remover o item: o informe volta.
3. Concluir uma venda paga: confirmação animada com **total e troco**; a venda limpa e o PDV
   volta ao caixa livre sem nenhum clique.
4. Concluir outra venda e **bipar um livro durante a animação**: a animação é dispensada na
   hora e o item entra na nova venda (nunca bloqueia).
5. Concluir uma venda e não tocar em nada: a animação se dispensa sozinha em poucos segundos.

## Regressão (nada mudou onde não devia)

- Lançamento de entrada: fluxo **idêntico** ao atual (sem tipo de nota, doador ou rateio).
- PDV: pagamento, troco e fechamento idênticos; `registrar_venda` com o mesmo payload.
- Relatórios existentes (vendas por forma) inalterados.
- Cancelamento de venda **recente** (< 5 dias) segue funcionando como hoje.
- `bash scripts/check-file-size.sh` (hook) — nenhum arquivo > 300 linhas significativas.
