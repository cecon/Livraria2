# Research — Destinação de estoque para doações (006)

Decisões da Phase 0. Nenhum NEEDS CLARIFICATION restou na spec; este documento registra as
decisões de modelagem que sustentam o plano (base do futuro ADR-0014).

## D1. "Custos" como resíduo, não como carimbo

**Decision**: apenas destinações especiais têm saldo carimbado (`destinacao_saldo`); o saldo
livre de um livro é `estoque físico − Σ carimbos` e pertence a "Custos" por definição.

**Rationale**: (a) zero migração de dados — todo o estoque atual e compras futuras já são
Custos; (b) "custo primeiro" emerge da regra de consumo (livre antes dos carimbos) sem ordem
especial; (c) impossível o total carimbado divergir do físico por deriva de contagem — o
resíduo absorve; (d) menos linhas (esparso, mesmo racional do `pagamento_pedido` da 005).

**Alternatives considered**: carimbar TODAS as unidades (incl. Custos) — exigiria backfill de
todo o estoque na migração, manutenção do invariante Σ carimbos = físico em todos os fluxos
(incl. contagem, que hoje força o estoque a um valor arbitrário) e não traz benefício;
**almoxarifados físicos** (multi-estoque) — resolveria localização, não contabilidade; tocaria
PDV, inventário e transferências (violaria SC-002 e KISS/YAGNI).

## D2. Saldo denormalizado + alocação por venda (sem razão próprio de carimbos)

**Decision**: `destinacao_saldo(livro_id, destinacao_id, qtd)` é atualizado transacionalmente
em cada operação; a auditoria vem de `alocacao_venda` (consumo por venda) + `item_lancamento_destinacao`
(criação por nota). Não criamos um "razão de movimentos de carimbo" espelhando o ADR-0008.

**Rationale**: o relatório (FR-016) e o estorno (FR-013) precisam da **alocação por item de
venda** de qualquer forma — ela já é o rastro de consumo. Um segundo razão duplicaria essa
informação (DRY) só para reconstruir um saldo que podemos manter na transação. Perdas de
inventário/ajuste não precisam de rastro por destinação (não entram no relatório de valores).

**Alternatives considered**: razão completo de carimbos (entrada/saída/estorno por destinação)
— mais auditável, porém redundante com alocações + rateios e mais um fluxo para manter
consistente; derivar saldo on-the-fly de rateios − alocações − perdas — exigiria registrar
perdas por destinação (que hoje não têm razão próprio) e torna cada leitura uma agregação
de 3 fontes.

## D3. Alocação grava apenas destinações especiais; Custos derivado

**Decision**: `alocacao_venda` só tem linhas para destinações especiais. No relatório e no
detalhe da venda, o valor/quantidade de Custos = total do item/período − Σ alocações especiais.
Vendas de períodos anteriores à feature aparecem 100% em Custos naturalmente.

**Rationale**: coerência com D1 (resíduo em todo lugar); mantém a tabela esparsa e o caminho
quente da venda (livros sem carimbo — a maioria) com **zero linhas extras**.

**Alternatives considered**: gravar também a linha de Custos — mais "explícito", mas infla a
tabela em todas as vendas e cria duas fontes para o mesmo número (Σ linhas vs. total), que
podem divergir.

## D4. Consumo e estorno na mesma transação, helper único

**Decision**: um helper `consumir_carimbos(txn, livro_id, qtd)` em `destinacao_sql.rs` aplica
a regra (livre primeiro, depois carimbos na ordem do cadastro) e devolve as alocações
efetuadas; é chamado pelos três caminhos de saída (venda em `pedido_repo.registrar`, ajuste,
diferença negativa de contagem) dentro da transação existente de cada fluxo. Estornos usam o
inverso: venda cancelada devolve pelos registros de `alocacao_venda`; nota de doação cancelada
subtrai os carimbos criados pelos rateios.

**Rationale**: a regra de ordem existe em UM lugar (DRY); consistência garantida pela
transação já existente em cada fluxo (a venda já grava pedido + movimentos + pagamentos numa
transação — carimbos e alocações entram nela).

**Alternatives considered**: trigger SQLite — regra de negócio no banco viola o Princípio I;
consumo pós-commit — janela de inconsistência entre físico e carimbos.

## D5. Guard de cancelamento de nota de doação por saldo suficiente

**Decision**: cancelar nota de doação é permitido apenas se, para cada (livro × destinação) da
nota, o saldo carimbado atual ≥ quantidade rateada pela nota (além do guard físico já existente
do estorno de entrada). Caso contrário, bloqueia com mensagem clara oferecendo manter a nota.

**Rationale**: implementa o FR-010 ("bloqueado se unidade consumida") de forma verificável por
SQL simples e sem rastrear proveniência por nota. Nuance aceita: se outra doação repôs o mesmo
carimbo, o cancelamento pode passar — o efeito contábil é idêntico (saldos corretos), então a
nuance é inofensiva e evita um razão de proveniência (YAGNI).

**Alternatives considered**: rastrear consumo por nota de origem (FIFO por lote) — exigiria
lotes de verdade (proveniência por unidade), complexidade de outra ordem sem requisito que a
justifique.

## D6. Doação entra no razão físico como `entrada` a custo zero

**Decision**: finalizar nota de doação usa o mesmo helper de entrada da compra
(`inserir_entrada_item`) com `custo_unit_centavos = 0`; `custo_medio_apos_entrada` já pondera
corretamente (puxa o médio para baixo). O campo `fornecedor` do movimento recebe o doador (ou
"Doação"), `referencia` = id da nota, como hoje.

**Rationale**: reusa 100% do caminho de entrada (razão, saldo, estorno físico); o custo zero é
a verdade econômica e foi decisão explícita da spec (Assumptions).

**Alternatives considered**: tipo de movimento novo `doacao` — o razão ganharia um tipo cuja
única diferença é custo 0; `entrada` com custo 0 + referência à nota já distingue na consulta.

## D7. Destinação padrão da nota em `padrao_json` (coluna TEXT)

**Decision**: o padrão da nota (destino único ou rateio percentual, ex. `[{"destinacaoId":2,"pct":50},…]`)
é persistido como JSON numa coluna `padrao_json` de `lancamento_entrada`. A **fonte de verdade**
do que entra é sempre o rateio por item (`item_lancamento_destinacao`); o padrão é conveniência
de preenchimento (prefill) aplicada no momento de adicionar o item.

**Rationale**: o padrão é presentacional/efêmero — não participa de consulta, soma ou relatório.
Uma tabela de junção só para prefill seria cerimônia (KISS). Quantidades e valores continuam
relacionais e em centavos/inteiros.

**Alternatives considered**: tabela `lancamento_destinacao_padrao` — relacional "puro", porém
mais código (entity, escrita, leitura) para um dado que nunca é agregado.

## D8. Sobra de arredondamento do rateio percentual vai para a primeira destinação

**Decision**: `ratear_percentual(qtd, [(dest, pct)…])` distribui `floor(qtd × pct)` e entrega
as unidades restantes à primeira destinação da lista. Função pura no domínio, ajustável por
item na UI antes de finalizar.

**Rationale**: determinístico, simples de explicar ao usuário ("a primeira leva a sobra") e
corrigível manualmente. Half-up por destinação poderia somar ≠ qtd (precisaria correção de
qualquer forma).

**Alternatives considered**: método dos maiores restos — mais "justo", porém imprevisível para
o usuário e irrelevante na escala (sobras de 1–2 unidades, sempre editáveis).

## D9. Migração `m007` no migrator padrão (sem boot especial)

**Decision**: `m007_destinacoes` como módulo do `Migrator` (estilo `m005_pedido_cancelado`):
`CREATE TABLE IF NOT EXISTS` (destinacao, destinacao_saldo, alocacao_venda,
item_lancamento_destinacao), `ALTER TABLE lancamento_entrada ADD COLUMN` tolerantes a
"duplicate column" (tipo/doador/padrao_json) e seed de "Custos" com `WHERE NOT EXISTS`.

**Rationale**: não há transformação de dados existentes (D1), logo não precisa do aparato da
`m006` (transação com verificação de Σ, rollback com bloqueio de boot). Idempotência trivial.

**Alternatives considered**: migração boot-applied com verificação — aparato sem o risco que o
justificou na 005 (lá havia rebuild destrutivo de `pedido`).

## D10. Valor da alocação = preço efetivo do item × quantidade alocada

**Decision**: `alocacao_venda.valor_centavos = qtd_alocada × item_pedido.preco_centavos`
(preço snapshot já é o efetivamente cobrado por unidade; não há desconto por item no sistema).
Se desconto por item existir no futuro, o valor da alocação acompanha o preço efetivo.

**Rationale**: garante SC-003 (Σ destinações = total do período) por construção, sem rateio de
centavos: o preço é por unidade inteira.

## D11. Destinar estoque existente = transferência de carimbo, não nota

**Decision**: o caso "o livro já está no estoque e só quero definir o destino" (US4) é uma
**transferência de destinação**: move quantidade entre Livre e destinações (ou entre
destinações) sem tocar no estoque físico nem no razão. Registrada em
`transferencia_destinacao` (livro, de → para, qtd, motivo opcional, data). Reversível pelo
próprio mecanismo (transferir de volta), sem guard de cancelamento.

**Rationale**: uma "nota de doação sem entrada física" misturaria dois efeitos no mesmo
fluxo (às vezes move físico, às vezes não) e arrastaria o guard de cancelamento para um caso
que não precisa dele. A transferência é o primitivo mínimo que cobre: destinação a
posteriori, correção de engano (de volta para Livre) e remanejamento entre destinos. A
tabela própria devolve a auditoria que `destinacao_saldo` sozinho não tem (D2).

**Alternatives considered**: variante da nota de doação com itens "do estoque existente" —
mais um modo no editor e no cancelamento para o mesmo efeito; editar `destinacao_saldo`
direto sem registro — sem trilha, quebraria a resposta a "de onde veio esse carimbo?".
