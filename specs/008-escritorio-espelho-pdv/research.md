# Research — Fase 0: Escritório espelho do PDV

Decisões que resolvem os pontos técnicos do plano. Formato: **Decisão / Rationale / Alternativas rejeitadas**. Baseado em levantamento do código real (domínio Rust, stack de UI dos dois apps, esquema-espelho da nuvem e ADRs 0015–0018).

## D1 — Onde vive a regra de negócio (o ponto central)

**Decisão**: **Uma fonte só — o domínio Rust puro** (`src-tauri/src/domain/`), extraído para o crate `livraria-domain` e compilado para **WASM**. O Escritório importa esse WASM e roda as mesmas funções; o PDV segue usando o mesmo crate nativamente.

**Rationale**:
- O domínio é comprovadamente **puro** (só `serde`+`thiserror`+`std`, sem I/O, sem relógio — o tempo entra como dado), portanto **compila para `wasm32-unknown-unknown` sem mudar código**. Só precisa sair do crate atual (que puxa tauri/sea-orm/reqwest/tokio, incompatíveis com wasm).
- Satisfaz o **DRY não-negociável**: custo médio ordenado, dinheiro-em-centavos, validação de venda, alocação, inventário e convergência ficam com **uma** implementação.
- Preserva o **offline do PDV** (invariante): o domínio continua embarcado no PDV; a nuvem é aditiva.

**Alternativas rejeitadas**:
- **Reimplementar as regras em TypeScript no Escritório** — viola o DRY explicitamente proibido; recria a divergência que já inviabilizou a tentativa anterior.
- **Mover a regra para o banco (funções/triggers Postgres)** — quebra o offline do PDV (que não alcança o banco sem internet) e duplica a lógica que precisa existir no cliente.

## D2 — Custo médio na nuvem (o derivado que falta)

**Decisão**: calcular `custo_medio` no Escritório pelo **mesmo fold do domínio via WASM** (`recompor_ledger` sobre os movimentos ordenados por `criado_em`). **Não** implementar `vw_custo_medio` em SQL.

**Rationale**: `vw_saldo_livro` já entrega o saldo na leitura (soma dos movimentos), mas `vw_custo_medio` não existe. Reproduzir o fold ponderado numa view SQL seria **uma segunda implementação da mesma regra** (viola DRY) e é frágil (ordem por `criado_em`, meia-para-cima). Como já teremos o domínio em WASM, o custo sai do mesmo código.

**Alternativas rejeitadas**: `vw_custo_medio` em SQL (duplica regra); porta do fold só em TS (duplica regra).

## D3 — Saldo e escrita de eventos na nuvem

**Decisão**: manter o padrão **já demonstrado** no Escritório atual — gerar `sync_uid` no cliente, inserir **pai-antes-de-filho por `sync_uid`**, carimbar `origem:"escritorio"`, `criado_por = auth.uid()`, `criado_em`/`atualizado_em` ISO; **saldo lido de `vw_saldo_livro`**. Cada operação de negócio emite os eventos corretos (venda emite `saida_venda`; entrada emite `entrada`; inventário emite ajuste).

**Rationale**: é o design pretendido pela feature 007 e conflito-livre (união aditiva de movimentos; ADR-0016). Saldo "simplesmente funciona" via view.

## D4 — Elevar duas regras ao domínio (pré-requisito de paridade)

**Decisão**: mover para funções **puras do domínio**:
- **Trava de baixa de venda** (ADR-0018): `baixa = min(qtd, estoque).max(0)` + sinalização quando `baixa < qtd`. Hoje em `adapters/persistencia/pedido_repo.rs`. Já existe o primitivo puro `Livro::estoque_apos_venda`.
- **Baseline de saldo inicial** (ADR-0017): regra `saldo_inicial = estoque − Σ movimentos` para completar o ledger. Hoje em `adapters/persistencia/estoque_repo.rs` (SQL).

**Rationale**: essas duas regras são as únicas que hoje vivem no adapter SQL; se ficarem lá, o Escritório teria de re-implementá-las (DRY). Elevá-las ao domínio faz PDV e nuvem compartilharem exatamente a mesma lógica. O PDV continua chamando as mesmas funções (refactor sem mudança de comportamento — coberto por testes).

**Alternativas rejeitadas**: deixar nos adapters (força duplicação no Escritório).

## D5 — UI idêntica sem divergir

**Decisão**: **workspace** + `packages/ui` compartilhado. Extrair de `src/` para `packages/ui`: os tokens `@theme`/`:root`/`.dark` (Tailwind v4, verde `#1f7a4d`, fonte Geist, dark por classe), os componentes `components/ui/*` (shadcn radix-nova) e `lib/utils` (`cn`). PDV e Escritório importam `@livraria/ui`. O Escritório adota Tailwind v4 (`@tailwindcss/postcss`), `next-themes`, `lucide-react` e replica a **mesma barra lateral** (10 itens, mesmos rótulos/ícones/ordem) e rotas.

**Rationale**: hoje os apps não compartilham nada visual (Escritório é um CSS de 65 linhas, sem Tailwind/shadcn). Uma fonte visual única realiza SC-004/FR-015 por construção. Os tokens `@theme` do Tailwind v4 são portáveis entre Vite e Next.

**Alternativas rejeitadas**: copiar tokens/componentes para o Escritório (drift garantido); manter dois estilos (contraria o objetivo).

**Blockers a tratar na implementação** (do levantamento): Tailwind v4 tem integração de build por app (plugin Vite vs `@tailwindcss/postcss` no Next); componentes interativos precisam de `"use client"` no App Router; alias `@/*` do Escritório aponta para a raiz (não `src`) — padronizar para o pacote; instalar `clsx`/`tailwind-merge`/`cva`/`lucide`/shadcn no Escritório; dark mode via `next-themes` espelhando a chave `eldl-theme`.

## D6 — Paridade de navegação e telas

**Decisão**: o Escritório passa a ter as **10 telas/rotas do PDV** com os mesmos rótulos: Início `/`, Venda `/venda`, Cadastro `/cadastro`, Pesquisa `/pesquisa`, Lançamentos `/lancamentos`, Fornecedores `/fornecedores`, Formas de Pagamento `/formas-pagamento`, Destinações `/destinacoes`, Inventário `/inventario`, Relatórios `/relatorios`. As telas atuais do Escritório (consulta, livros, recebimento, operadores…) são **realinhadas** a esse mapa (ver `contracts/ui-parity.md`).

**Rationale**: FR-002/FR-005 exigem mesma estrutura de navegação e conjunto de telas.

## D7 — Estado de conexão e escopo online-only

**Decisão**: o Escritório é **online-only**; exibe estado de conexão e **bloqueia gravações** quando sem acesso à nuvem, com mensagem clara (FR-010). Não há modo offline no Escritório (é o oposto do PDV, e está ok — o PDV cobre o offline).

## D8 — Concorrência e convergência

**Decisão**: **reusar as regras de convergência da feature 007/ADR-0016** — last-write-wins por `atualizado_em` (hora do servidor) para recursos mutáveis (livro, fornecedor); soft-delete por `excluido_em`; movimentos são append-only e disjuntos por origem (PDV baixa, Escritório entrada) → conflito-livre. Como o domínio de convergência (`domain::sincronizacao`) também vai para o WASM, a decisão é a mesma nas duas pontas (FR-014).

## D9 — Venda e Inventário completos na nuvem (US3)

**Decisão** (decorre das respostas de escopo): o Escritório **conclui venda** (carrinho → `pedido`/`item_pedido`/`pagamento_pedido` + `saida_venda` com clamp do domínio) e **realiza inventário** (contagem por digitação/câmera → movimentos de ajuste), usando o domínio WASM para validações/derivados. O saldo corrente para o clamp vem de `vw_saldo_livro`.

**Rationale**: paridade total pedida; risco mitigado por rodar exatamente as mesmas regras do PDV (clamp, custo, validação de conclusão) via WASM.

## D10 — Turno de operação como entidade de domínio (compartilhada)

**Decisão**: modelar o **Turno de operação** como **entidade pura no domínio** — tipo **`TurnoOperacao`** no arquivo **`crates/livraria-domain/src/turno_operacao.rs`** (nome distinto do enum `Turno` por horário, para não colidir) — com funções puras `abrir(operador, caixa_inicial?)`, `pode_registrar_venda(turno)`, `proximo_numero(qtd_atual) -> n`, `resumir_fechamento(pagamentos_do_turno) -> resumo`, `encerrar(resumo, conferido) -> {esperado, conferido, diferenca}`. Persistido por adapters: SQLite (PDV) e Supabase (Escritório). Estado: `Aberto`/`Encerrado`.

**Rationale**: o turno carrega **regra de negócio** (quando pode vender, como numerar, como fechar o caixa) que deve ser **idêntica** nas duas pontas → entra no domínio puro e vai para o WASM (DRY, mesma regra PDV↔nuvem). Preserva o offline: o PDV abre/fecha turno e vende **sem internet**, sincronizando depois.

**Alternativas rejeitadas**: turno só na camada de aplicação/UI de cada app (duplicaria a regra); turno só na nuvem (quebra offline do PDV).

## D11 — Numeração de Pedido Nº por turno (offline-safe, conflito-livre)

**Decisão**: `pedido.numero_no_turno` é **sequencial dentro do turno** (1..n), calculado por `proximo_numero(qtd_de_pedidos_do_turno)` no domínio. Cada turno pertence a **uma origem** (um dispositivo/operador) → o próximo número sai da **contagem local dos pedidos daquele turno**, sem alocador central. Identidade real: `pedido.sync_uid`; agrupador: `pedido.turno_uid`.

**Rationale**: resolve o "sequencial contínuo" (Princípio VI) **sem colisão** entre PDV e Escritório e **sem depender de rede** (invariante offline). Como turnos têm `sync_uid` distintos, a união na nuvem nunca colide.

**Alternativas rejeitadas**: numeração global contínua (exige alocador central → quebra offline e reintroduz colisão); faixas por origem sem turno (menos aderente ao pedido do usuário de "contidas nos turnos").

## D12 — Fechamento de caixa no encerramento

**Decisão**: ao encerrar, o domínio computa o **resumo** a partir dos `pagamento_pedido` das vendas do turno: **totais por forma de pagamento**, **qtd de vendas** e **valor esperado** (caixa inicial + entradas em dinheiro, conforme regra); a UI coleta o **valor conferido** e o domínio calcula a **diferença**. O turno passa a `Encerrado` e não aceita novas vendas.

**Rationale**: fechamento de caixa é regra de negócio → domínio puro (mesmo cálculo nas duas pontas). A conferência é entrada do usuário; a diferença é registrada, sem impedir o encerramento (edge case de divergência).

**Alternativas rejeitadas**: só marcar fim sem resumo (não atende a decisão do usuário); cálculo do resumo na UI (duplicaria regra).

## D13 — Esquema e convergência do turno

**Decisão**:
- **SQLite local (`m009`)**: tabela `turno_operacao` + colunas `pedido.turno_uid`, `pedido.numero_no_turno`. Idempotente por comando (Princípio IV).
- **Nuvem (`0004_turno.sql`)**: mirror `turno_operacao` (`sync_uid` PK + colunas de sync `origem/atualizado_em/excluido_em/criado_por/sincronizado_em`), FK `pedido.turno_uid → turno_operacao(sync_uid)`, `pedido.numero_no_turno`, RLS `to authenticated`. Idempotente.
- **Sync**: incluir `turno_operacao` na `ORDEM_DEPENDENCIA` **antes de `pedido`**. Convergência: campos mutáveis do turno (status, encerramento) por **LWW** (`atualizado_em` de servidor); como o turno é *origin-owned*, conflito é improvável. Movimentos/pedidos do turno seguem as regras existentes.

**Rationale**: reusa o padrão de mirror/sync da 007 (chave `sync_uid`, colunas de sync, RLS). Mantém idempotência e o offline.

## Riscos / pontos de atenção

- **Ledger completo é pré-condição** para o saldo/custo corretos na nuvem (ADR-0017): antes de o Escritório operar sobre um livro, é preciso garantir baseline de saldo inicial (mesma reparação que o PDV faz em `adotar`).
- **Custo do fold no navegador**: O(n movimentos) por livro; para telas que listam muitos livros com custo, paginar/entrar sob demanda.
- **Tamanho do WASM** e carregamento: expor só o necessário do domínio; carregar de forma assíncrona.
- **`"use client"`** e SSR do Next: telas interativas rodam no cliente; leitura inicial pode usar server components onde não houver interação.
- **Turno esquecido aberto** (virada de dia): definir política — alerta de turno de longa duração e/ou encerramento assistido; não encerrar silenciosamente sem resumo. (Detalhe operacional a fixar nas tasks.)
- **Migração de dados legados de pedido**: pedidos existentes sem `turno_uid` — `m009`/`0004` devem tolerar `turno_uid` nulo (histórico) e só exigir turno para **novas** vendas.
