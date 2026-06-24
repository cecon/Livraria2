# Phase 0 — Research & Decisões: Movimentação de Estoque & Inventário

Todas as ambiguidades de alto impacto foram resolvidas em `/speckit-clarify` (ver `spec.md` › Clarifications).
Não restam `NEEDS CLARIFICATION`. As decisões abaixo viram ADRs em `docs/adr/`.

## D1 — Razão de movimentos como fonte da verdade (→ ADR-0008)

- **Decisão**: criar tabela `movimento_estoque` (append-only, imutável). O `livro.estoque` é um **saldo
  materializado** mantido em sincronia (cache), mas a soma dos movimentos é a verdade. Reconciliação:
  `estoque == Σ qtd dos movimentos do livro` (SC-001).
- **Rationale**: dá auditoria permanente (quem/por quê), unifica entrada/venda/ajuste/contagem num só
  mecanismo, e torna o inventário trivial. Alinha com o espírito de reconciliação exata da constituição.
- **Alternativas rejeitadas**: (a) só campo mutável + tela de ajuste — sem histórico, inventário vira
  "sobrescrever número"; (b) saldo derivado puro (sem cache em `livro.estoque`) — exigiria recomputar a
  soma a cada leitura de tela, custo desnecessário num app de balcão. Mantemos o cache + invariante.

## D2 — Saldo inicial dos livros migrados (→ ADR-0008)

- **Decisão**: na adoção, gerar **um movimento `saldo_inicial`** por livro com a quantidade atual de
  `livro.estoque`. Passo **idempotente** em runtime (no boot, como `garantir_admin`): só cria para livros
  que **não têm nenhum movimento**. Re-executar não duplica.
- **Rationale**: faz a invariante valer desde o dia 1 sem reescrever histórico de vendas (mantém FR-004).
- **Alternativas rejeitadas**: backfill via migration SQL pura (não tem a lógica de "só se faltar movimento"
  de forma limpa e re-rodável); reconstruir de vendas históricas (contraria FR-004, complexo).

## D3 — Custo médio ponderado por livro (→ ADR-0009)

- **Decisão**: `livro.custo_medio_centavos`, recalculado **só em entrada (compra)**:
  `novo = round_half_up((estoque × medio_atual + qtd × custo_unit) / (estoque + qtd))`, em centavos i64.
  Ajuste e contagem **não** alteram o custo médio. `saldo_inicial` entra com custo médio 0 (legado sem custo).
- **Rationale**: custo médio é a valorização padrão e suficiente; independe de FIFO/lotes (YAGNI). O
  arredondamento half-up em centavos é determinístico e documentado; o custo médio é valorização derivada,
  não afeta a invariante de quantidade.
- **Entrada total↔unitário**: a tela aceita um dos dois; o domínio deriva o outro
  (`unit = round_half_up(total / qtd)` ou `total = unit × qtd`). Persistimos o **custo unitário** no
  movimento de entrada.
- **Alternativas rejeitadas**: FIFO/lotes (complexidade não pedida); guardar só custo da última compra
  (menos fiel para margem).

## D4 — Código de barras separado (→ data-model)

- **Decisão**: `livro.codigo_barras` (EAN/ISBN) **opcional**, distinto do `codigo` (PK interna). A bipagem
  busca por `codigo_barras`; não achando, fallback de busca por nome/título (reusa `buscar_texto`).
- **Rationale**: EAN impresso ≠ código interno na maioria dos casos; opcional não quebra o acervo migrado.
  Se um livro tiver `codigo_barras` = `codigo`, ainda funciona.
- **Alternativas rejeitadas**: assumir `codigo` = EAN (nem sempre verdade); múltiplos códigos por livro
  (YAGNI nesta versão).

## D5 — Inventário: sessão, modos e reconciliação no fechamento (→ ADR-0010)

- **Decisão**: `sessao_inventario` com `modo` (`parcial`/`total`), `rotulo` (ex.: "Gaveta A") e `status`
  (`aberta`/`fechada`/`cancelada`). Cada bipagem incrementa `item_contagem.qtd_contada`. No **fechamento**:
  captura `qtd_sistema` (saldo atual) por item contado, gera movimento `contagem` com
  `qtd = contado − qtd_sistema` (estoque resultante = contado). **Parcial**: ajusta só itens contados.
  **Total**: livros ativos não bipados são tratados como contagem 0 (após confirmação explícita).
  Fechamento **idempotente** (sessão fechada não reaplica). Cancelar não altera estoque.
- **Rationale**: referência no fechamento garante que, pós-inventário, o estoque reflete o contado (objetivo
  da conferência). Parcial evita zerar a loja ao contar aos poucos.
- **Pendências**: código bipado sem livro (nem por nome) vira `pendencia_cadastro` (não trava a contagem).
- **Concorrência**: app mono-estação; uma sessão aberta por vez. Sessão aberta é retomável no boot.
- **Alternativas rejeitadas**: snapshot na abertura (ignora vendas durante a contagem); bloquear vendas
  durante a sessão (rígido demais p/ o balcão).

## D6 — Estoque nunca negativo (→ domínio)

- **Decisão**: ajuste cujo resultado seria < 0 é **barrado** (domínio retorna erro). Contagem sempre define
  valor contado ≥ 0, então a diferença nunca leva abaixo de zero. Venda mantém piso atual.
- **Rationale**: estoque físico não é negativo; barrar mantém a invariante limpa, sem clamping que mascara
  erro de digitação.

## D7 — Integração com a venda existente

- **Decisão**: `pedido_repo.registrar()` passa a inserir, na **mesma transação** da baixa, um movimento
  `saida_venda` por item (referência = número do pedido). `importar()` (histórico) continua **sem** movimento.
- **Rationale**: completa o ledger sem quebrar atomicidade nem o comportamento de importação (FR-003/FR-004).
- **Atenção (Princípio III)**: vigiar o tamanho de `pedido_repo.rs`; extrair helper de inserção de movimento
  se aproximar de 300 linhas.

## D8 — Sem novas dependências

- **Decisão**: tudo com a stack atual (SeaORM/SQLite/serde/Tauri/React/shadcn). Leitor de código de barras é
  tratado como entrada de teclado (HID) — um campo focado que captura o código + Enter; sem driver/lib.
