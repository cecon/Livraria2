# ADR-0024: PDV consumidor — cadastros somente-leitura e retaguarda na nuvem

## Status

Aceito. (Registrado retroativamente para a feature 012; referenciado pela constituição v2.0.0 e por ADR-0023.)

## Contexto

A fase 1 (ADR-0023) profissionalizou o **estoque oficial na nuvem** por venda pronta. A fase 2
("a nuvem manda", feature 012) conclui a **redução de responsabilidade do PDV**: ele deixa de ser
**editor de cadastros** e **contador de estoque oficial** e passa a **consumir** o que a nuvem
publica + **produzir fatos operacionais** (venda/cancelamento).

Antes disso, o PDV mantinha janelas de edição de cadastros, gerava contabilidade local de estoque
(entrada de nota, ajuste, inventário, destinar) e ainda carregava o importador do legado Access — o
que duplicava mecânica, criava risco de corromper a nuvem num install novo e mantinha código morto.

## Decisão

1. **Cadastros somente-leitura no PDV**: fornecedor, forma de pagamento, destinação e o **acervo
   (livro)** descem por sincronização e são **read-only** no PDV; a **edição vive na nuvem/escritório**.
   O PDV não semeia mais formas/Loja/admin (nasce vazio e baixa da nuvem no 1º sync) — evita corromper
   a nuvem num install limpo.
2. **Retaguarda na nuvem**: **entrada de notas**, **inventário** e a operação de **destinar estoque**
   saem do PDV e vivem na nuvem/escritório (podem exigir conexão — alinhado ao invariante v2.0.0).
3. **Cancelamento como fato**: o cancelamento passa a **subir** como fato operacional (zera
   `sincronizado_em`, bumpa `atualizado_em`), e a nuvem estorna oficialmente (triggers 0012/0013).
   Corrige o incidente de estorno em produção.
4. **Remoção de código morto**: importador do legado Access, editor de acervo, dashboard antigo e a
   contabilidade local de entrada/ajuste/perda são removidos do PDV (uma única fonte contábil: a nuvem).
   O vocabulário do ledger compartilhado com o WASM/escritório é preservado.

## Consequências

- (+) Uma única autoridade contábil (nuvem); PDV menor e mais simples; sem duplicação de mecânica.
- (+) Install novo não corrompe a nuvem; o PDV converge por sync.
- (−) Funções de retaguarda exigem conexão (aceitável — não são operação de balcão).
- Invariante offline (v2.0.0) preservado: **venda/cancelamento/consulta de saldo** seguem 100% offline.
- Base para a fase 3 (feature 013): turno como unidade, venda push-only e retenção local — ver ADR-0025.
