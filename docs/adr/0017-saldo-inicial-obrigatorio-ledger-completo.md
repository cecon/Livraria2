# ADR-0017 — Estoque: `saldo_inicial` obrigatório e reparo do ledger incompleto

**Status**: Aceito · **Data**: 2026-07-21 · **Complementa/corrige**: [ADR-0008](0008-razao-movimentos-estoque.md), [ADR-0016](0016-sync-identidade-convergencia.md)

## Contexto
A ADR-0008 fixou o invariante **SC-001: `estoque == Σ qtd dos movimentos`** e disse que o
`saldo_inicial` é gerado na adoção **"só para livros sem movimento"**. A ADR-0016 fez o saldo/`custo_medio`
serem **recomputados por fold do ledger** após cada merge de sync — o que só é correto **se o invariante
valer**.

Na base de produção real havia um caso que quebra essa premissa: um livro cujo `livro.estoque` veio do
**import direto do legado** (ADR-0006), mas que **já tinha movimentos** de venda. Como `adotar` só cria
`saldo_inicial` para livros **sem** movimento, esse livro ficou **sem baseline** → `Σ movimentos ≠ estoque`
(invariante SC-001 violado, porém **latente e inofensivo** enquanto o `livro.estoque` cacheado era a
fonte de leitura).

**Incidente (A PONTE, 1 de 499 livros):** `estoque` cacheado = 128, mas `Σ movimentos` = −61 (entrada
+187, estornos −186, vendas −60, contagem −2; **sem `saldo_inicial`**). Quando a sincronização (ADR-0016)
**recomputou** os derivados, sobrescreveu o cache correto (128) pela soma do ledger incompleto (−61) →
o livro apareceu **esgotado** no PDV. A nuvem, que **não guarda `estoque` como coluna** (deriva por
`vw_saldo_livro` = Σ movimentos), refletia o mesmo valor errado.

## Decisão
- **O `saldo_inicial` é pré-condição do fold, não uma conveniência.** O invariante SC-001 é **global**:
  todo livro deve ter um ledger cuja soma seja igual ao seu estoque real. Sem baseline, a recomputação
  da ADR-0016 **não pode** rodar sobre o livro sem corromper o cache.
- **`adotar` passa a reparar, não só semear.** Em vez de "só para livros sem movimento", cria/ajusta um
  `saldo_inicial` para **todo livro em que `Σ movimentos ≠ estoque`**, com
  `qtd = estoque − Σ movimentos` (idempotente: se já bate, não faz nada; roda em runtime na inicialização).
  Isso restaura SC-001 para os livros herdados do legado e torna o fold da ADR-0016 seguro por construção.
- **Reparo do dado existente** é o mesmo mecanismo aplicado uma vez: inserir o `saldo_inicial` faltante
  (na origem/PDV e/ou direto na nuvem, que converge pelo sync). O `saldo_inicial` entra com `criado_em`
  **anterior** a qualquer movimento, para ser o primeiro no fold (ordem por `criado_em`, ADR-0016).
- **A nuvem continua sem coluna `estoque`** (deriva do ledger). Justamente por isso o ledger **tem** de
  ser completo — caso contrário o escritório web lê estoque errado.

## Consequências
- (+) A recomputação de sync converge para o estoque real em todo livro; some a classe de bug
  "sync zera o estoque de livro herdado do legado".
- (+) O invariante SC-001 deixa de ser "por construção nos livros novos" e passa a ser **garantido e
  reparável** para toda a base.
- (−) `adotar` faz uma varredura `Σ movimentos vs estoque` na inicialização (barata: uma agregação por
  livro; idempotente). Correções de baseline são movimentos novos, nunca edição de histórico (ADR-0008).

## Alternativas rejeitadas
- **Guardar `estoque` como coluna na nuvem e sincronizar o número**: reintroduz o campo mutável dependente
  de ordem que a ADR-0016 rejeitou (diverge com intercalação PDV/escritório).
- **Não recomputar no sync e confiar no cache local**: o escritório (que só tem o ledger) continuaria sem
  fonte de saldo; e entradas do escritório não chegariam ao PDV.
- **Manter `adotar` só para livros sem movimento**: deixa o invariante quebrado para os casos herdados —
  exatamente a causa do incidente.
