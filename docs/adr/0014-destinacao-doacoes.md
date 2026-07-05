# ADR-0014 — Destinação de estoque para doações: Loja como resíduo, carimbos com prioridade de venda

**Status**: Aceito · **Data**: 2026-07-05

## Contexto
A livraria é filantrópica e recebe doações de livros com **destino definido do valor das vendas**
(ex.: 220 cópias — 10 para a Loja cobrir custos, 210 para Missões). É preciso rastrear para onde vai
o valor de cada venda e apurar por período, **batendo com o caixa**, sem mudar o fluxo do PDV nem o
lançamento de entrada. O estoque físico é um só (mesma prateleira); a demanda é **contábil**
(fund accounting), não de localização — multi-almoxarifado foi rejeitado por tocar PDV/inventário
(spec 006, SC-002; KISS/YAGNI).

## Decisão (specs/006-destinacao-doacoes/research.md D1–D9)
- **Camada de carimbos sobre o estoque único**: `destinacao` (cadastro; "Loja" com `de_sistema=1`,
  fixa no topo, renomeável apenas), `destinacao_saldo` (carimbo por livro × destinação, sempre ≥ 0).
  O **saldo livre** é o resíduo `estoque − Σ carimbos` — nunca armazenado — e pertence à Loja por
  definição. Consequência: **zero migração de dados** (m007 só cria tabelas + seed, sem ALTERs).
- **Carimbo tem prioridade de venda** (pedido do usuário: a doação é compromisso com o doador):
  a venda consome **carimbos na ordem do cadastro (Loja sempre 1ª) → livre**. Perdas, ajustes
  negativos, contagem para baixo e **estorno de lançamento de entrada** fazem o **inverso**
  (livre → carimbos), protegendo o compromisso — e dispensando guard extra no cancelamento de nota
  (o invariante Σ carimbos ≤ físico nunca quebra). Regras puras em `domain/alocacao.rs`
  (`alocar_venda`/`alocar_perda`); mecânica transacional única em `destinacao_sql::consumir_carimbos`
  (modo Venda/Perda), chamada **antes** da baixa física, na mesma transação de cada fluxo.
- **Entrada em dois passos, sem nota de doação**: livros doados entram pelo **lançamento normal**
  (custo digitado, ex. R$ 0,00) e a destinação é definida depois pela **transferência**
  ("Destinar estoque": livre ↔ carimbos, inclusive carimbo Loja), único mecanismo de criação de
  carimbos, auditável em `transferencia_destinacao` (de/para/qtd/motivo/data) e reversível por ela
  mesma. Guards: origem ≠ destino, saldo suficiente na origem, destino ativo.
- **Alocação gravada na venda** (`alocacao_venda`): uma linha por **carimbo consumido** (inclusive
  Loja — sem ela o estorno devolveria ao livre e corroeria a prioridade do lote). Consumo do livre
  **não** gera linha; no relatório, Loja = total − Σ demais (cobre livre + carimbo Loja) — uma única
  fonte para o número, sem risco de divergência. Estorno de venda devolve pelas alocações
  (idempotente via flag `cancelado`); exclusão de item devolve e **remove** as linhas do item.
- **Estorno retroativo + janela de 5 dias**: venda cancelada some do período no relatório
  (`pedido.cancelado = 0`, como os relatórios existentes); em contrapartida o cancelamento é
  bloqueado após **5 dias corridos** (`domain::pedido::pode_cancelar_venda`, aplicado em
  `application/cancelamento.rs` no comando `excluir_pedido`, erro `VENDA_ANTIGA`) — protege
  fechamentos e repasses já feitos.
- **Apuração**: `relatorio_destinacoes(inicio, fim)` soma alocações das especiais e deriva a Loja;
  seção **"Posição atual"** (Σ `destinacao_saldo` por destinação) responde "quanto ainda falta
  vender para cada destino". Detalhe da venda exibe a distribuição por item (Loja consolidada no
  backend). Importador do legado intocado: vendas antigas = Loja por definição.

## Consequências
- O PDV não muda (SC-002): consumo e alocação são efeitos internos da transação de `registrar`.
- Auditoria completa por três registros: transferências (origem dos carimbos), alocações (consumo
  em venda) e o razão físico existente (ADR-0008) — perdas não precisam de rastro por destinação.
- A deriva é impossível por construção: o livre é derivado, e toda saída baixa as duas camadas na
  mesma transação; a nuance do guard "por saldo" (outra doação pode repor o carimbo e liberar um
  cancelamento) é contabilmente neutra.
- Custo: 1 SELECT + N updates de carimbo por item vendido **apenas** quando o livro tem carimbo;
  o caminho quente (livro sem carimbo) ganha só uma consulta de carimbos vazia.
- UI nova mínima: cadastro de Destinações (clone da 005), dialog "Destinar estoque" no livro,
  visão "Vendas por Destinação" nos relatórios, badges no detalhe da venda; e os estados visuais
  do PDV (caixa livre + confirmação animada com total/troco, auto-dispensada, nunca bloqueante).
