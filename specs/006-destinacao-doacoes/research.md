# Research — Destinação de estoque para doações (006)

Decisões da Phase 0, revisadas após as clarificações de 2026-07-04 (base do futuro ADR-0014).
A revisão mais importante: **não há nota de doação** — a entrada usa o lançamento normal
existente e os carimbos nascem exclusivamente pela transferência de destinação.

## D1. "Loja" é o padrão e o livre é o resíduo; carimbos têm prioridade de venda

**Decision**: "Loja" é a destinação de sistema (padrão). O **saldo livre** de um livro é
`estoque físico − Σ carimbos` e pertence à Loja por definição — não é armazenado. A ordem de
baixa na **venda** é: carimbos na ordem do cadastro (**Loja sempre primeiro**), depois o
livre. Qualquer destinação pode ser carimbada, inclusive a Loja (ex.: "10 para cobrir custos"
vendem antes de tudo).

**Rationale**: (a) zero migração de dados — estoque atual e compras futuras são livre = Loja;
(b) a doação é um **compromisso com o doador**: com 1.000 livres em prateleira e carimbos
10 Loja / 20 Missões, o valor de Missões deve entrar após as 10 primeiras vendas, não após
1.020 — carimbo antes do livre garante isso; (c) impossível o total carimbado divergir do
físico por deriva de contagem — o resíduo absorve; (d) sem carimbo, sem linha (esparso, mesmo
racional do `pagamento_pedido` da 005).

**Alternatives considered**: livre antes dos carimbos (desenho inicial) — adiaria o
compromisso com o doador indefinidamente quando há estoque pré-existente do mesmo título;
carimbar TODAS as unidades — backfill de todo o estoque na migração e invariante rígido
Σ = físico em todos os fluxos, sem benefício; **almoxarifados físicos** — resolveria
localização, não contabilidade; tocaria PDV e inventário (violaria SC-002 e KISS/YAGNI).

## D2. Saldo denormalizado + registros de origem/consumo (sem razão próprio de carimbos)

**Decision**: `destinacao_saldo(livro_id, destinacao_id, qtd)` é atualizado transacionalmente
em cada operação; a auditoria vem de `transferencia_destinacao` (criação/remanejo) +
`alocacao_venda` (consumo em venda). Não criamos um "razão de movimentos de carimbo"
espelhando o ADR-0008.

**Rationale**: o relatório (FR-016) e o estorno (FR-010) precisam da alocação por item de
venda de qualquer forma, e a transferência já registra a criação — um segundo razão duplicaria
essas informações (DRY). Perdas de inventário não precisam de rastro por destinação (não
entram no relatório de valores).

**Alternatives considered**: razão completo de carimbos — mais um fluxo para manter
consistente, redundante com transferências + alocações; derivar saldo on-the-fly — cada
leitura viraria agregação de 3 fontes e perdas precisariam de registro por destinação.

## D3. Alocação grava consumo de carimbo (inclusive Loja); o livre é derivado

**Decision**: `alocacao_venda` tem uma linha para **cada carimbo consumido** — inclusive
carimbo Loja (sem ela o estorno não saberia recompor o carimbo). Consumo do saldo **livre**
não gera linha. No relatório, Loja = total do período − Σ alocações de destinações ≠ Loja
(cobre livre + carimbo Loja); no detalhe da venda, a parte do livre é derivada por item.
Vendas de períodos anteriores à feature aparecem 100% em Loja naturalmente.

**Rationale**: o caminho quente (livros sem carimbo — a maioria) continua com **zero linhas
extras**; o estorno devolve cada unidade exatamente ao carimbo de origem; e o número da Loja
tem uma única fonte (derivação), sem risco de divergência entre Σ linhas e total.

**Alternatives considered**: gravar também o consumo do livre — infla a tabela em todas as
vendas e cria duas fontes para o mesmo número; não gravar o carimbo Loja — estorno devolveria
ao livre, corroendo silenciosamente a prioridade de venda do lote doado.

## D4. Consumo e estorno na mesma transação, helper único com duas ordens

**Decision**: um helper `consumir_carimbos(txn, livro_id, qtd, modo)` em `destinacao_sql.rs`
aplica a regra de ordem conforme o fluxo — **venda**: carimbos na ordem do cadastro (Loja 1º)
e depois o livre; **perda/ajuste/estorno de entrada**: livre primeiro e depois os carimbos
(inverso — protege o compromisso com o doador) — e devolve as alocações efetuadas; é chamado
pelos caminhos de saída (venda em `pedido_repo.registrar`, ajuste, diferença negativa de
contagem, estorno de lançamento) dentro da transação existente de cada fluxo. Estorno de
venda devolve pelos registros de `alocacao_venda`.

**Rationale**: as duas ordens existem em UM lugar (DRY); consistência garantida pela
transação já existente em cada fluxo. Tratar o estorno de lançamento de entrada como perda
mantém o invariante Σ carimbos ≤ físico **sem nenhum guard extra**.

**Alternatives considered**: trigger SQLite — regra de negócio no banco viola o Princípio I;
consumo pós-commit — janela de inconsistência entre físico e carimbos; guard bloqueando
cancelamento de lançamento com unidades carimbadas — atrito desnecessário, já que consumir
como perda é sempre consistente.

## D5. Entrada de doação = lançamento normal; carimbo nasce só por transferência

*(clarificação de 2026-07-04 — substitui o desenho anterior de "nota de doação" com rateio.)*

**Decision**: não existe tipo de nota "doação". Livros doados entram pelo **lançamento de
entrada normal** (custo digitado pelo responsável — ex.: R$ 0,00), e a destinação é definida
depois pela **transferência** ("Destinar estoque"): livre → Missões, livre → Loja etc.

**Rationale**: um fluxo de entrada só (KISS — zero mudança em `lancamento_entrada`, editor,
importador); a transferência já era necessária para o caso "livro já em estoque", então ela
vira o mecanismo único de carimbo (DRY); o custo deixa de ser regra do sistema e vira decisão
do responsável no lançamento (que já suporta custo zero); cancelamento de nota não precisa de
guard especial (estorno de entrada consome como perda — D4).

**Alternatives considered**: nota de doação com rateio por item e padrão percentual (desenho
anterior) — mais telas, mais validações (Σ do rateio, sobra de arredondamento), guard de
cancelamento próprio e uma segunda origem de carimbos para auditar; o usuário preferiu
explicitamente o fluxo em dois passos.

## D6. Valor da alocação = preço efetivo do item × quantidade alocada

**Decision**: `alocacao_venda.valor_centavos = qtd_alocada × item_pedido.preco_centavos`
(preço snapshot já é o efetivamente cobrado por unidade; não há desconto por item no sistema).

**Rationale**: garante SC-003 (Σ destinações = total do período) por construção, sem rateio
de centavos: o preço é por unidade inteira.

## D7. Migração `m007` no migrator padrão (sem boot especial)

**Decision**: `m007_destinacoes` como módulo do `Migrator` (estilo `m005_pedido_cancelado`):
`CREATE TABLE IF NOT EXISTS` (destinacao, destinacao_saldo, alocacao_venda,
transferencia_destinacao) e seed de "Loja" com `WHERE NOT EXISTS`. **Nenhum ALTER** em tabelas
existentes (a nota de doação saiu do escopo).

**Rationale**: não há transformação de dados existentes (D1/D5), logo não precisa do aparato
da `m006` (transação com verificação de Σ, rollback com bloqueio de boot). Idempotência trivial.

## D8. Estorno retroativo no relatório + janela de 5 dias no cancelamento de venda

*(clarificação de 2026-07-04.)*

**Decision**: venda cancelada some do período original (o relatório reflete sempre o estado
atual — mesmo comportamento dos relatórios existentes via `pedido.cancelado = 0`). Em
contrapartida, o cancelamento de venda passa a ser **bloqueado após 5 dias corridos** da
venda (`pode_cancelar_venda` no domínio + guard no caso de uso), protegendo fechamentos e
repasses já feitos.

**Rationale**: manter lançamento negativo em período posterior exigiria um segundo modelo de
apuração; a janela curta elimina na prática o caso "cancelar venda de período fechado".

**Alternatives considered**: estorno como lançamento negativo no período do cancelamento —
estilo contábil, mas cria dois regimes de leitura e diverge dos relatórios atuais.

## D9. Posição atual dos carimbos na tela do relatório

*(clarificação de 2026-07-04.)*

**Decision**: a tela do relatório por destinação ganha a seção "Posição atual": Σ de
`destinacao_saldo.qtd` por destinação (todos os livros), independente do período. Sem
drill-down por livro nesta feature.

**Rationale**: responde "quanto ainda falta vender para cada destino?" com uma agregação
barata sobre dados que já existem; drill-down é YAGNI até haver demanda real.
