# ADR-0018 — Baixa de venda limitada ao estoque cacheado: drift silencioso quando o cache diverge

**Status**: Aceito · **Data**: 2026-07-21 · **Relaciona**: [ADR-0008](0008-razao-movimentos-estoque.md), [ADR-0017](0017-saldo-inicial-obrigatorio-ledger-completo.md)

## Contexto
A venda registra a baixa com um teto no estoque cacheado, para **nunca deixar `estoque` negativo**
(FR-003, invariante SC-001). Em `pedido_repo.rs::registrar`:

```rust
let baixa = it.qtd.min(estoque_atual).max(0);
if baixa > 0 { /* cria saida_venda + UPDATE livro SET estoque = estoque - baixa */ }
```

Ou seja, a baixa efetiva é `min(qtd_vendida, estoque)`. O pedido, o item e o pagamento são gravados
**sempre** (a venda acontece para o cliente), mas o `saida_venda` e o decremento **só existem se havia
estoque cacheado positivo**.

Isso acopla a corretude do estoque à corretude do **cache**. Se o `livro.estoque` estiver **errado para
baixo** (ex.: um livro que a recomputação de sync corrompeu para ≤ 0 — a classe de bug da ADR-0017),
a venda passa com `baixa = 0`: **nenhum movimento, nenhum decremento, e nenhum aviso**. O resultado é
**drift real de inventário** (o livro físico saiu, o sistema não registrou), não um mero erro de tela.

**Incidente:** venda 6294 (2× A PONTE) foi feita ~8 min **antes** do reparo do `saldo_inicial`. Como A
PONTE estava esgotada naquele instante, `baixa = min(2, 0) = 0` → a venda subiu (pedido/item/pagamento),
mas **sem `saida_venda`**. Depois do reparo, o ledger mostrava 128 (como se nada tivesse saído); os 2
tiveram de ser lançados à mão (`saida_venda −2`, referência 6294) para chegar ao 126 real.

## Decisão
- **O teto `min(qtd, estoque)` é mantido** — a garantia de "estoque nunca negativo" (SC-001/FR-003) vale
  mais que registrar automaticamente uma baixa maior que o saldo conhecido. A alternativa (permitir
  negativo) esconde erro de cadastro e quebra o custo médio (ADR-0009).
- **A corretude do cache passa a ser pré-condição operacional explícita**, garantida pela ADR-0017: um
  livro só fica "esgotado" se realmente estiver — então a venda não deixa de dar baixa por dado sujo.
- **O drift deixa de ser silencioso.** Quando `baixa < qtd` (vendeu-se item com estoque insuficiente no
  cache), o caso deve ser **sinalizado** (log/telemetria e, idealmente, aviso no PDV), para virar exceção
  visível — não uma perda invisível de inventário. *(recomendação de implementação; a venda em si não é
  bloqueada — o balcão nunca trava.)*
- **Correção de drift = movimento novo** (ADR-0008): registrar `saida_venda`/`ajuste` retroativo com a
  `referencia` do pedido, nunca editar histórico.

## Consequências
- (+) Documenta a fronteira: "venda gravada" ≠ "estoque baixado"; os dois só coincidem com o cache
  correto. Torna a ADR-0017 uma dependência **operacional**, não só de sincronização.
- (+) Sinalizar `baixa < qtd` transforma a próxima ocorrência em alerta acionável.
- (−) Enquanto o aviso não existir, drift por cache errado depende de auditoria (Σ movimentos vs. vendas)
  para ser detectado.

## Alternativas rejeitadas
- **Permitir estoque negativo** para sempre registrar a baixa cheia: viola SC-001, mascara erro de
  cadastro e contamina o custo médio ponderado (ADR-0009).
- **Bloquear a venda quando `estoque ≤ 0`**: trava o balcão por causa de dado possivelmente sujo —
  inaceitável para o PDV (a venda física já está acontecendo).
