# ADR-0015 — Sincronização com a nuvem: hub Supabase, PDV réplica offline, escritório web

**Status**: Aceito · **Data**: 2026-07-20

## Contexto
A livraria opera hoje 100% offline (Tauri + SQLite, mono-estação). Surgiram duas necessidades que o
modelo local-só não atende (spec 007): o **escritório** precisa **receber livros e cadastrar** com o
**notebook desligado**, e o **PDV** precisa continuar **vendendo sem internet**. São dois pontos de
escrita que podem estar indisponíveis um para o outro. Isso tensiona a restrição constitucional
original ("Sem backend HTTP; funcionamento offline; SQLite local; só Tauri") — resolvido pela **emenda
1.1.0**, que permite sincronização opcional sob invariante de offline do PDV, login/RLS e segredos fora
do binário.

## Decisão (specs/007-sincronizacao-nuvem/research.md D1–D3, D9–D14)
- **Nuvem como hub** (Supabase/Postgres, já provisionado): guarda o log mesclado. O **PDV mantém o
  SQLite local como réplica offline** e sincroniza deltas — o SQLite continua a **fonte de operação**
  do balcão (invariante da emenda 1.1.0). A nuvem **nunca** é a única fonte de operação do PDV.
- **Escritório = cliente web fino** (`apps/escritorio`, React + Vite **estático**, `supabase-js`),
  sempre online, hospedado no Portainer. **Sem Next.js/SSR** (YAGNI) — só páginas que leem/gravam a
  nuvem. Reuso de tipos/telas com o PDV via `packages/` (monorepo, **npm-only**).
- **Canal e autenticação**: acesso via **PostgREST/HTTPS** com **Supabase Auth por usuário** e **RLS
  por usuário**; toda gravação do escritório carrega **autoria** (`criado_por = auth.uid()`),
  permitindo auditoria e revogação individual. **`service_role` nunca** vai em cliente (binário ou
  bundle web); no Rust o adapter usa token de usuário de baixo privilégio. Segredos administrativos
  ficam só na Memória do Projeto (Notion), fora do repositório.
- **Hexagonal preservado**: a nuvem entra **exclusivamente** por porta `SyncPort` (application) +
  adapter `adapters/nuvem/supabase_sync.rs`. O domínio não conhece Supabase. Sync roda em **background**
  quando online e é disparável sob demanda; a **venda nunca bloqueia** por sync.
- **Escopo sincronizado**: livro, movimentos de estoque, vendas (com forma de pagamento — 005),
  recebimentos, **fornecedores** (003), cadastros de formas de pagamento (005) e destinação/alocação
  (006) — para os relatórios do escritório ficarem completos. Um **seed inicial idempotente** carrega
  todo o histórico existente para a nuvem.
- **Escritas disjuntas** minimizam conflito: PDV gera saídas/vendas; escritório gera entradas/
  recebimento. Cadastros de 005/006 são gerenciados no PDV e replicados para leitura no escritório.
- **Derivados como VIEW na nuvem** (`vw_saldo_livro`, `vw_custo_medio`) e **CHECKs** como fonte única
  de invariante — o escritório grava **eventos crus**, sem reimplementar regra de negócio em TS.

## Consequências
- **Positivas**: escritório opera com o notebook desligado; PDV segue offline; convergência eventual
  simples; núcleo Rust intacto (só um adapter novo); segurança com login/RLS e sem segredo no cliente.
- **Custos/risco**: deixa de ser "só desktop" (novo app web + deps `reqwest`/`uuid`/`supabase-js`);
  superfície de dados maior (005/006/fornecedores); depende de conectividade intermitente (aceito) e
  de operação/segurança do Supabase Cloud.
- **Alternativas rejeitadas**: conexão Postgres direta do binário (credencial extraível, porta 5432
  exposta); auto-hospedar Supabase no Portainer (ops de DB sem ganho no porte); backend próprio
  intermediário (YAGNI); manter só SQLite (não resolve o problema declarado).
- A **identidade estável, deduplicação e recomputação de derivados** que garantem a idempotência são
  tratadas no **ADR-0016**.
