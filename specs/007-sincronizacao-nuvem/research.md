# Research — Sincronização com a nuvem (007)

Formato por decisão: **Decisão / Rationale / Alternativas rejeitadas**. Estas decisões alimentam os **ADR-0015** (arquitetura de sync) e **ADR-0016** (identidade e convergência), e a **emenda 1.1.0** da constituição.

## D1 — Topologia: nuvem como hub, PDV como réplica offline

- **Decisão**: Supabase/Postgres é o **hub** com o log mesclado (verdade compartilhada). O PDV mantém o SQLite local como **réplica** que opera offline e sincroniza deltas. O escritório é cliente web sempre-online.
- **Rationale**: cobre os dois requisitos P1 (escritório com notebook desligado; PDV sem internet) com consistência eventual. Mono-PDV mantém escritas disjuntas.
- **Alternativas rejeitadas**: SQLite como verdade única (não permite escritório independente); Postgres como única base com o PDV sempre-online (quebra o offline do balcão).

## D2 — Provisionamento: Supabase Cloud gerenciado

- **Decisão**: usar o **Supabase Cloud** já provisionado (projeto/senha na Memória do Projeto no Notion).
- **Rationale**: KISS — sem ops de banco. Já pago/existente.
- **Alternativas rejeitadas**: auto-hospedar Supabase no Portainer (soma manutenção de DB, backups, upgrades sem ganho para o porte); backend próprio (YAGNI).

## D3 — Canal PDV↔nuvem e autenticação: PostgREST/HTTPS + Supabase Auth por usuário (RLS)

- **Decisão**: o adapter `supabase_sync.rs` e o app do escritório falam com a **API PostgREST** do Supabase por HTTPS. **Autenticação por usuário** via **Supabase Auth** (login próprio de cada operador do escritório; o PDV usa uma identidade de serviço/usuário dedicada). **RLS por usuário** confina o acesso; toda gravação carrega **autoria** (`auth.uid()`). **`service_role` nunca** vai em cliente algum. (Clarificação 2026-07-20.)
- **Rationale**: login por usuário dá **auditoria** (quem gravou) e **revogação individual** — pedido do autor. RLS não expõe conexão Postgres direta nem abre a 5432; upsert nativo (`Prefer: resolution=merge-duplicates`) dá idempotência.
- **Alternativas rejeitadas**: chave `anon` compartilhada sem login (sem auditoria/revogação — rejeitada na clarificação); conexão Postgres direta do Tauri (credencial extraível, superfície de ataque); backend intermediário próprio (complexidade sem necessidade).
- **Nota de segurança**: mesmo em binário a credencial é extraível — por isso token de **usuário** de baixo privilégio + RLS, nunca `service_role`.

## D4 — Identidade estável (`sync_uid`) + deduplicação por chave natural

- **Decisão**: adicionar `sync_uid TEXT` (UUID v4) **imutável**, gerado na origem, a **todas** as tabelas sincronizáveis (`movimento_estoque`, `livro`, `pedido`, `item_pedido`, `pagamento_pedido`, `lancamento_entrada`, `item_lancamento`, `fornecedor`, `forma_pagamento`, `destinacao`, `transferencia_destinacao`, `alocacao_venda`). A sincronização usa `sync_uid` como chave de conflito; o `id` autoincrement local continua só para FKs internas. **Além disso**, entidades com chave de negócio têm **deduplicação por chave natural**: `livro` por **código de barras**, `fornecedor` por **nome/documento** (Clarificação 2026-07-20).
- **Rationale**: `movimento_estoque.id` é autoincrement e **colidiria** entre PDV e nuvem (ambos gerariam id=100) — UUID dá unicidade global. Mas dois lados podem criar o **mesmo livro/fornecedor** offline com `sync_uid` diferentes; a dedup por chave natural evita duplicata (um índice único em `codigo_barras` / nome+documento faz os dois convergirem para um registro).
- **Mecânica da dedup**: no merge, antes de inserir um `livro`/`fornecedor` novo, casa pela chave natural; se já existe, trata como update (LWW) do registro existente em vez de criar outro `sync_uid`.
- **Alternativas rejeitadas**: só `sync_uid` sem dedup natural (geraria livros/fornecedores duplicados — rejeitado na clarificação); chave composta `(origem, id_local)` (atrito nas FKs); reusar `id` local (colisão garantida).

## D5 — Estoque: eventos crus + derivados recomputados (o ponto sutil)

- **Decisão**: sincronizar **apenas os movimentos crus** (`tipo, qtd, custo_unit, livro_codigo, criado_em, sync_uid`). **Nunca** sincronizar `livro.custo_medio_centavos` nem saldo. Após cada merge, **recomputar** o `custo_medio` por **fold determinístico do ledger** (ADR-0009) por livro, dos dois lados.
- **Rationale**: `livro.custo_medio_centavos` é um **campo cacheado dependente de ordem** (m004). Sincronizá-lo como valor causaria divergência quando entradas do escritório se intercalam com movimentos do PDV. Como o custo médio é um **fold puro** sobre o ledger, recomputar após merge converge sempre.
- **Alternativas rejeitadas**: sincronizar o custo médio como número (diverge); recomputar a cada leitura sem cache (custo/perf, e muda contrato atual). Mantém-se o cache, mas **recomputado pós-merge**.
- **Verificar na implementação**: a recomputação precisa ser um fold sobre `movimento_estoque` ordenado por `criado_em` (tempo confiável) — não por `id` local, que não é comparável entre origens.

## D6 — Convergência sem conflito: escritas disjuntas + append-only

- **Decisão**: PDV só gera **saídas de venda** (e ajustes/contagens locais); escritório só gera **entradas** (recebimento). Movimentos são **imutáveis** → merge = união idempotente por `sync_uid`, **independente de ordem** (o saldo é soma). Ordem só importa para o **fold do custo médio**, resolvida por `criado_em`.
- **Rationale**: elimina resolução de conflito no recurso mais quente (estoque). É um contador grow-only (CRDT na prática).
- **Alternativas rejeitadas**: locking distribuído / merge 3-way de saldo (complexo, desnecessário com 1 PDV e escritas disjuntas).

## D7 — Recursos mutáveis compartilhados (Livro e Fornecedor): last-write-wins

- **Decisão**: `livro` (título, preço, cadastro) **e `fornecedor`** são editáveis nos dois lados; convergem por **última edição** via `atualizado_em` (tempo do servidor, D9). Upsert por chave natural (livro=código de barras; fornecedor=nome/documento) só sobrescreve se `atualizado_em` recebido ≥ o local. Fornecedor entra no escopo porque o escritório faz recebimento e precisa poder cadastrar fornecedor novo com o notebook desligado (Clarificação 2026-07-20).
- **Rationale**: edição de cadastro é rara e de baixo conflito; LWW é suficiente e simples para ambos.
- **Alternativas rejeitadas**: fornecedor só-leitura no escritório (impede receber de fornecedor novo offline — rejeitado na clarificação); merge campo-a-campo (complexidade sem ganho); travar edição em um lado (piora UX).

## D8 — Deleções: soft delete

- **Decisão**: exclusões marcam `excluido_em` (timestamp) em vez de remover a linha; a marca sincroniza como um update normal e o item some das listas dos dois lados.
- **Rationale**: upsert nunca remove; soft delete propaga deleção de forma idempotente e auditável. Movimentos não se apagam (append-only); soft delete vale para cadastro (livro).
- **Alternativas rejeitadas**: hard delete + tombstones (mais mecanismo); reconciliação por diff de conjuntos (mais caro, deixado como fallback futuro).

## D9 — Referência de tempo confiável (watermark e LWW)

- **Decisão**: usar o **tempo do servidor Supabase** como referência: coluna `sincronizado_em DEFAULT now()` na nuvem serve de **cursor de pull** (puxa `WHERE sincronizado_em > last_cursor`); `atualizado_em` para LWW também ancora no servidor quando possível. O relógio local do PDV **não** é autoridade.
- **Rationale**: relógios de balcão derrapam; ancorar no servidor evita perder/duplicar no cursor e decisões LWW erradas.
- **Alternativas rejeitadas**: relógio do cliente (drift); vetor de versão/Lamport (overkill para 2 nós).

## D10 — Rastreio do que enviar/puxar: outbox leve + cursor

- **Decisão**: no PDV, cada escrita sincronizável recebe `sincronizado_em = NULL` (pendente); o push envia os `NULL`, marca com o retorno; o pull guarda `last_cursor` na tabela local `sync_cursor`. Idempotência do upsert torna o watermark uma **otimização**, não correção — re-enviar tudo continua correto.
- **Rationale**: mínimo mecanismo que evita reenviar a base inteira, sem uma tabela de outbox separada.
- **Alternativas rejeitadas**: outbox transacional dedicada (mais tabelas/escrita); CDC/replication logic (fora de escopo/porte).

## D11 — Órfãs históricas e ordem de push (memória do projeto)

- **Decisão**: o push ordena **pais antes de filhas** (livro → movimento/pedido → itens). Antes de enviar, **validar integridade referencial** contra o conjunto local; linhas órfãs (ex.: movimento apontando `livro_codigo` inexistente) são **isoladas e reportadas**, sem abortar o lote. O seed inicial (carga da base atual para a nuvem) roda a mesma validação.
- **Rationale**: memória do projeto — SQLite local não faz enforce de FK e há **órfãs históricas**; o Postgres **vai** enforçar e rejeitaria o lote. Isolar mantém o sync vivo (FR-012).
- **Alternativas rejeitadas**: desligar FK na nuvem (perde a garantia que motiva usar Postgres); abortar tudo numa órfã (trava o sync). Ver memória `sqlite-fks-nao-enforced`.

## D12 — App do escritório: web estático + monorepo

- **Decisão**: app **React + Vite estático** em `apps/escritorio`, falando com o Supabase via `@supabase/supabase-js` (RLS). Hospedado no **Portainer** do usuário (container nginx servindo o build). Tipos/telas compartilhados com o PDV via `packages/`. **Sem Next.js.**
- **Rationale**: o escritório só precisa de páginas que leem/gravam Supabase — não há necessidade de servidor/SSR. Estático é o mais simples de hospedar e manter.
- **Alternativas rejeitadas**: Next.js (SSR/servidor sem uso → complexidade); embutir no Tauri (não roda no navegador do escritório).
- **Cuidado (memória `npm-only-lockfile`)**: ao adicionar o app web ao workspace, usar **npm** e não corromper o lockfile (nada de pnpm/npm 11).

## D13 — Carga inicial (seed) do histórico completo

- **Decisão**: ao ativar a sincronização, um passo de **seed idempotente** empurra **todo o histórico existente** (livros, movimentos, vendas+pagamentos, recebimentos, fornecedores, cadastros 005/006) para a nuvem, na **ordem pais→filhas**, isolando e reportando órfãs (D11). Reexecutar o seed não duplica (upsert por `sync_uid`). Caso de uso `application/seed_nuvem.rs`; comando `seed_inicial`. (Clarificação 2026-07-20.)
- **Rationale**: o escritório precisa enxergar o estoque e o histórico reais desde o dia 1; sem seed, a nuvem começaria vazia e o estoque não bateria (SC-009).
- **Alternativas rejeitadas**: começar só com dados novos (estoque na nuvem não bate); subir só o saldo atual como "saldo inicial" (perde histórico de vendas para relatórios do escritório). Ambas rejeitadas na clarificação.
- **Nota**: como `sync_uid` é gerado no backfill da `m008`, o seed é só um push do que está pendente (`sincronizado_em IS NULL`) — reusa o mesmo caminho do sync incremental.

## D14 — Escopo de dados sincronizados (núcleo + 005 + 006 + fornecedores)

- **Decisão**: sincronizar **livro, movimento_estoque, pedido/item_pedido, pagamento_pedido (005), lancamento_entrada/item_lancamento, fornecedor (003), forma_pagamento (005), destinacao/transferencia_destinacao/alocacao_venda (006)**. Vendas sobem **com** forma de pagamento e alocações de destinação, para os relatórios do escritório ficarem completos. (Clarificação 2026-07-20.)
- **Rationale**: o autor quer relatórios completos no escritório (repasse por destinação, formas de pagamento). Movimentos/vendas/alocações são **append-only** → mesma mecânica idempotente; cadastros de 005/006 são de baixo conflito (gerenciados no PDV, replicados p/ leitura).
- **Alternativas rejeitadas**: só o núcleo (livro/estoque/vendas/recebimento) — deixaria os relatórios 005/006 fora do escritório; rejeitado na clarificação.
- **Cuidado**: os cadastros de 005/006 são principalmente **PDV→nuvem (um dono)**; só livro e fornecedor são bidirecionais-mutáveis (D7).
