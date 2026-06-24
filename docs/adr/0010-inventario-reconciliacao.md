# ADR-0010 — Inventário: sessão parcial/total e reconciliação no fechamento

**Status**: Aceito · **Data**: 2026-06-23

## Contexto
O inventário é feito bipando os livros (leitor de código de barras = teclado HID). A livraria conta o
acervo aos poucos (ex.: "hoje só a Gaveta A"), então zerar tudo o que não foi contado é perigoso
(spec 002 FR-020..030, SC-003/004/006).

## Decisão
Uma **`sessao_inventario`** com `modo` (`parcial`/`total`), `rotulo` (ex.: "Gaveta A") e `status`
(`aberta`/`fechada`/`cancelada`). Cada bipagem incrementa `item_contagem.qtd_contada` (casa por
`codigo_barras` **ou** `codigo`); código desconhecido vira `pendencia_cadastro` sem travar a contagem. No
**fechamento**: captura `qtd_sistema` (saldo atual) por item, gera movimento `contagem` com
`qtd = contado − qtd_sistema` (estoque final = contado). **Parcial** ajusta só itens contados; **total**
trata livros ativos não bipados como contagem 0, exigindo confirmação explícita. Fechamento idempotente
(sessão fechada não reaplica). Cancelar não altera estoque. As divergências ficam recuperáveis após o
fechamento pelos movimentos `contagem` cuja `referencia` é o id da sessão (FR-029).

## Consequências
- (+) Referência no fechamento garante que, pós-inventário, o estoque reflete o contado.
- (+) Parcial evita zerar a loja ao contar por partes.
- (−) Mono-estação: assume-se uma sessão aberta por vez; sessão aberta é retomável no boot.

## Alternativas
Snapshot na abertura (ignora vendas durante a contagem — rejeitado). Bloquear vendas durante a sessão
(rígido demais para o balcão — rejeitado).
