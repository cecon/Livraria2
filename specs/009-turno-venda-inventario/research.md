# Research — Feature 009: Turno, Venda e Inventário na nuvem

Fase 0 do plano. Cada decisão segue o formato **Decisão / Racional / Alternativas**. As decisões
herdam a fundação da 008 (WASM, `@livraria/ui`, workspace) e as três clarificações da 009.

## D1 — Turno de operação como entidade pura no domínio (reuso ADR-0021)

- **Decisão**: criar `crates/livraria-domain/src/turno_operacao.rs` com o tipo `TurnoOperacao` e funções
  **puras**: `abrir(operador, caixa_inicial?)`, `pode_registrar_venda(status)`,
  `proximo_numero(qtd_no_turno) -> n`, `resumir_fechamento(pagamentos_do_turno, caixa_inicial) -> ResumoCaixa`,
  `encerrar(resumo, conferido_dinheiro) -> Fechamento{esperado, conferido, diferenca}`. Estado
  `Aberto`/`Encerrado`. Exposto ao Escritório via WASM.
- **Racional**: é a **única regra nova**; sendo pura, vale igual no PDV (nativo) e no Escritório (WASM) por
  construção (DRY, Princípio II; Hexagonal, Princípio I). ADR-0021 já ratificou a decisão.
- **Alternativas**: implementar o turno só no adapter de cada ponta → duas fontes da mesma regra (viola DRY);
  reusar o enum `Turno` (horário Manhã/Tarde) → colisão de nomenclatura proibida pelo ADR-0021.

## D2 — Nomenclatura: `TurnoOperacao` ≠ `Turno` (horário)

- **Decisão**: o novo tipo é **`TurnoOperacao`**; o `Turno` existente (`pagamento.rs`, Manhã/Tarde derivado da
  hora) permanece **intacto** e continua no `pedido.turno`. São conceitos distintos que coexistem.
- **Racional**: Princípio VI (fidelidade ao vocabulário) — o "Turma da Manhã/Tarde" é termo do negócio; o
  "turno de operação" (abre/fecha caixa) é o conceito novo. Não sobrescrever.
- **Alternativas**: renomear/ძsobrecarregar `Turno` → quebraria relatórios e o vocabulário do usuário.

## D3 — Fechamento de caixa: conferência **só do dinheiro** (clarify Q1)

- **Decisão**: no `resumir_fechamento`, o **esperado** conferível = `caixa_inicial + Σ vendas em dinheiro do
  turno`; o **conferido** = contagem física do dinheiro (coletado pela UI); `diferenca = conferido − esperado`.
  Os totais das demais formas (crédito, PIX, ministério, vale) entram no resumo apenas como **informativos**
  (sem contagem física). A diferença é registrada e **não impede** o encerramento.
- **Racional**: é o padrão de fechamento de caixa — só o dinheiro tem gaveta física para conferir; cartão/PIX
  não têm contagem. Decidido na clarify Q1. A forma "dinheiro" é resolvida pela aplicação por **chave estável**
  (`ChaveSistema::Dinheiro`, ADR-0013) — o domínio não conhece rótulos.
- **Alternativas**: conferência por cada forma → redundante para cartão/PIX (sem contagem física), mais atrito.

## D4 — Inventário: sessão parcial/total + reconciliação, **reusando `inventario.rs`** (clarify Q2)

- **Decisão**: o Escritório reusa as regras já existentes do domínio via WASM —
  `inventario::ModoInventario{Parcial,Total}`, `contagem_efetiva(modo, contada)`, `resumir(itens)` e
  `estoque::diferenca_contagem`. O operador abre uma sessão **parcial** (subconjunto) ou **total**, conta por
  digitação/câmera, e no **fechamento** o sistema reconcilia (`contagem_efetiva` + `diferenca_contagem`) e
  emite os **ajustes**.
- **Racional**: paridade real com o PDV (ADR-0010) sem reescrever regra (DRY). As funções já estão no domínio;
  falta só expor `contagem_efetiva`/`resumir` no WASM (D8) — `diferenca_contagem` já está exposta.
- **Alternativas**: contagem total simples sem modo/parcial → menos fiel ao PDV, rejeitada na Q2.

## D5 — Inventário na nuvem **não cria tabelas novas**: sessão no cliente + ajustes em `movimento_estoque`

- **Decisão**: o espelho da 007 **não mirrora** `sessao_inventario`/`item_contagem` (inventário é local do PDV;
  a nuvem só vê o `movimento_estoque` resultante). O Escritório roda a **sessão de contagem no cliente**
  (rascunho persistido em `localStorage`, como o rascunho de venda do PDV em `lib/venda.ts`); ao fechar, aplica
  a reconciliação via WASM e grava **apenas os ajustes** como `movimento_estoque` (tipo `ajuste`), que
  sincronizam para o PDV.
- **Racional**: KISS/YAGNI (Princípio II) — evita expandir o esquema-espelho e um novo caminho de convergência
  só para um rascunho efêmero. O resultado durável (ajustes) já tem tabela mirrorada. SC-004 ("mesmos ajustes
  que o PDV") é satisfeito pela **regra idêntica** (WASM), não por espelhar a sessão. Preserva o desenho da 007
  (inventário PDV-local).
- **Alternativas**: mirrar `sessao_inventario`/`item_contagem` na nuvem (0006) → contagem durável/multi-dispositivo
  e visível no PDV, mas +2 tabelas, +RLS, +convergência para um ganho fora do escopo declarado (YAGNI). Fica
  registrado como evolução futura se surgir necessidade de contagem colaborativa.

## D6 — Numeração: **Pedido Nº por turno**, offline-safe (contexto por origem)

- **Decisão**: `pedido.numero_no_turno = proximo_numero(qtd_pedidos_do_turno)`. No Escritório, `qtd` vem de um
  `count` dos pedidos com `turno_uid = turno_atual`; no PDV, da contagem local. O `pedido.numero` global
  contínuo **permanece** (não quebra relatórios/legado); `numero_no_turno` é a numeração **exibida por turno**.
- **Racional**: cada turno pertence a **uma origem** e tem `sync_uid` distinto → numeração conflict-free entre
  PDV e Escritório e calculável **sem alocador central** (invariante offline, Constituição + ADR-0021).
- **Alternativas**: numeração global via alocador central → quebra offline; faixas por origem sem turno → menos
  aderente ao pedido do usuário.

## D7 — Um turno aberto por operador/origem (clarify Q3)

- **Decisão**: ao abrir turno, a aplicação verifica que **não há turno `Aberto` do mesmo operador naquela
  origem**; se houver, bloqueia e orienta a encerrar o atual. Dois turnos abertos do mesmo operador em
  **origens diferentes** (PDV e Escritório) continuam permitidos (contextos próprios).
- **Racional**: previsibilidade — sem ambiguidade de "qual turno recebe a venda" (Q3). A checagem é do adapter
  (consulta de estado), com a regra de status (`Aberto`) no domínio.
- **Alternativas**: múltiplos turnos abertos por origem → escolha de turno por venda, mais complexo (rejeitado
  na Q3).

## D8 — Fronteira WASM: expor validação de venda + troco e funções do turno

- **Decisão**: adicionar wrappers em `crates/livraria-domain-wasm/src/lib.rs` (fronteira `f64`/`JsValue`, padrão
  atual): (a) **venda** — `validar_conclusao(itens, pagamentos, dinheiro_forma_id) -> ok|erro` e `troco/restante`
  (métodos de `Pedido`); (b) **turno** — `turno_proximo_numero`, `turno_resumir_fechamento`, `turno_encerrar`,
  `turno_pode_registrar_venda`. Wrappers apenas embrulham o domínio (regra única).
- **Racional**: hoje o WASM só expõe estoque/custo/formatação; sem esses wrappers o Escritório seria forçado a
  reescrever a validação da venda em TS (viola DRY). O CI (`.github/workflows/wasm.yml`) regenera
  `@livraria/domain` — build no CI por causa do Windows SAC (os error 4551).
- **Alternativas**: recompute em TS → duas fontes da regra de venda (proibido).

## D9 — Escrita da venda na nuvem: quais tabelas e em que ordem

- **Decisão**: concluir uma venda grava (upsert por `sync_uid`, LWW, `origem="escritorio"`): `pedido`
  (com `turno_uid` + `numero_no_turno` + `operador_uid` do usuário logado) → `item_pedido` → `pagamento_pedido`
  → `movimento_estoque` (tipo saída de venda, `qtd = clamp_baixa_venda(qtd, saldo)`) → `alocacao_venda`. O
  **saldo** para o clamp vem de `movimento_estoque` (derivado, `recompor_ledger`/`vw_saldo_livro`), nunca de
  coluna.
- **Racional**: reproduz o caminho do PDV (`application/venda.rs`) contra o esquema-espelho existente; usa as
  regras do domínio (clamp, validação) via WASM (D8). `turno_operacao` entra na `ORDEM_DEPENDENCIA` **antes de
  `pedido`** (ADR-0021), garantindo FK por `sync_uid`.
- **Alternativas**: recompute de saldo server-side (view/trigger nova) → recompute redundante (a 008 já decidiu
  derivar por WASM/`vw_saldo_livro`).

## D10 — Operador da venda/turno = usuário logado (modelo #15)

- **Decisão**: `turno_operacao.operador_uid`, `pedido.operador_uid` e `criado_por` vêm do **`app_user`** (o
  `usuario.sync_uid` real do operador logado, gravado no cookie pelo login do #15) — **não** de `auth.uid()`.
  Sem seletor de operador extra — quem abre o turno é o operador.
- **⚠️ Por que não `auth.uid()`**: o #15 abre uma **sessão de serviço compartilhada** (todos os operadores
  usam a mesma sessão Supabase), então `auth.uid()` é **idêntico para todos**. Usá-lo carimbaria todos os
  turnos/vendas com uma só identidade, quebrando "um turno aberto por operador" (FR-001) e o vínculo
  operador↔venda (FR-002). A RLS `to authenticated` continua autenticando pela sessão compartilhada; a
  **identidade do operador é de nível de aplicação** (`app_user`).
- **Racional**: o login do #15 já identifica o operador no cookie `app_user`; a feature **não redefine acesso**.
  Mantém KISS.
- **Alternativas**: usar `auth.uid()` → identidade única para todos (incorreto sob sessão compartilhada);
  seletor de operador por venda → duplicaria identidade e contrariaria o modelo do #15.

## D11 — Migrations idempotentes: `m009` (SQLite) e `0010_turno.sql` (nuvem)

- **Decisão**: **SQLite `m009`** aplicada imperativamente em `inicializar_schema()` após `m008` (estilo
  idempotente `aplicar` de m004/m006/m008): `CREATE TABLE IF NOT EXISTS turno_operacao (...)` + `ALTER TABLE
  pedido ADD COLUMN turno_uid/numero_no_turno` tolerando "duplicate column". **Nuvem `0010_turno.sql`**: mirror
  `turno_operacao` (chave `sync_uid` + colunas de sync + índice `idx_turno_operacao_sinc on (sincronizado_em)`)
  + `ALTER TABLE pedido ADD COLUMN IF NOT EXISTS turno_uid/numero_no_turno` + RLS `to authenticated`.
- **Racional**: Princípio IV (idempotência por comando); segue exatamente o padrão já verificado no repo (map do
  Explore). O número **0010** é o próximo livre (0004/0005 do #15; 0006–0009 da feature 010) — corrige a
  menção "0004" do ADR-0021.
- **Alternativas**: registrar `m009` inline no `Migrator::migrations()` vec → também válido, mas as ALTERs com
  tolerância a coluna duplicada ficam mais limpas no estilo `aplicar` standalone.

## D12 — Convergência/concorrência do turno (reuso ADR-0016)

- **Decisão**: `turno_operacao` é *origin-owned*; campos mutáveis (status, encerramento) convergem por **LWW**
  (`atualizado_em` de servidor), como as demais entidades. Entra na `ORDEM_DEPENDENCIA` antes de `pedido`.
- **Racional**: conflito é improvável (cada turno tem uma origem dona); reusa a estratégia de sync já existente.
- **Alternativas**: merge campo-a-campo → complexidade sem ganho (turno não é co-editado).

## D13 — Export de relatórios (pendência 008, US4): Excel/PDF/WhatsApp

- **Decisão**: nos Relatórios do Escritório, além de Imprimir, adicionar **Exportar Excel** (arquivo `.xlsx`
  gerado no cliente a partir das linhas já carregadas), **Exportar PDF** (impressão para PDF/`@media print`
  reaproveitando a folha de impressão) e **Compartilhar WhatsApp** (resumo textual via `https://wa.me/?text=`).
  Mesmos números do PDV (dados vêm das mesmas queries/domínio).
- **Racional**: fecha a pendência sem nova regra de negócio (formatação/serialização é adapter). Geração no
  cliente evita endpoint novo (KISS; sem `service_role`).
- **Alternativas**: geração server-side (edge function) → infra nova desnecessária para volume de balcão.

## D14 — Testes: ida-e-volta, acesso e concorrência (pendência 008, US4)

- **Decisão**: (a) **conformidade** nativo↔WASM para turno/venda/inventário (mesmo input → mesmo output),
  estendendo `crates/livraria-domain/tests/conformance.rs`; (b) **ida-e-volta PDV↔nuvem** (uma venda/ajuste
  gravado numa ponta aparece e confere na outra após sync); (c) **acesso** (operações exigem sessão autenticada
  — RLS `to authenticated`); (d) **convergência concorrente** (duas edições convergem por LWW sem perda).
- **Racional**: cobre SC-003/004/005 e os quality gates (regras testadas sem UI/banco). Reusa o arcabouço de
  conformidade da 008.
- **Alternativas**: só testes manuais → não atende ao gate de cobertura da constituição.

## D15 — Saneamento de ADRs (Princípio V)

- **Decisão**: (a) **renumerar** o ADR do "Escritório reusa domínio via WASM" de **0019 → 0022** (colisão com o
  `0019` de identidade unificada usuário/senha do #15), atualizando o índice/README de ADRs e as referências;
  (b) **corrigir** ADR-0021 onde cita `0004_turno.sql` → **`0010_turno.sql`**.
- **Racional**: Princípio V exige ADRs consistentes; duas decisões com o mesmo número é dívida a sanear antes de
  implementar.
- **Alternativas**: deixar a colisão → confunde rastreabilidade (rejeitado).

## Itens explicitamente fora de escopo (YAGNI)

- Mirror de `sessao_inventario`/`item_contagem` na nuvem (contagem colaborativa/durável) — ver D5.
- Política automática de "turno esquecido aberto" na virada de dia além de **alerta/encerramento assistido**
  (nunca silencioso) — o encerramento continua manual/assistido (ADR-0021, edge case da spec).
- Qualquer recompute de saldo/custo server-side novo (mantém-se o fold via WASM/`vw_saldo_livro`).
