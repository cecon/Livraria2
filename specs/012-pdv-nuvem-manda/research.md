# Research — PDV de responsabilidade reduzida — fase 2 (feature 012)

Decisões de design (Fase 0). Sem `NEEDS CLARIFICATION` remanescente (spec clarificado).

## D1 — Cancelamento do PDV vira fato que sobe (corrige o bug)

- **Decisão**: `excluir_pedido` (PDV) passa a marcar `cancelado=1`, `cancelado_em`, **`sincronizado_em
  = NULL`** e bumpar `atualizado_em = now()`. Deixa de gerar `estorno` local. O sync re-empurra o
  pedido (LWW por `atualizado_em`); a nuvem, no `trg_pedido_estoque_cancelamento` (já existe), cria o
  `estorno_venda` oficial e republica o saldo (via `0012`).
- **Rationale**: o `pendentes` do sync filtra `sincronizado_em IS NULL`; sem zerar, o cancelamento
  nunca re-sincroniza (raiz do bug). O `pedido` já empurra `cancelado`/`cancelado_em`
  (`replica_mapa`), e a nuvem já sabe estornar — falta só o PDV **mandar**.
- **Alternativas rejeitadas**: estorno na nuvem por polling (frágil); manter estorno local (recria a
  trilha dupla que queremos remover).

## D2 — Venda deixa de gerar movimento oficial no PDV

- **Decisão**: `registrar` (PDV) grava pedido + itens + pagamentos + `estoque_status='pronta'` e **não**
  insere `movimento_estoque` `saida_venda` nem decrementa a coluna `estoque`. O saldo exibido passa a
  ser o **saldo operacional** (`saldo_publicado − vendas não sincronizadas + cancelamentos não
  sincronizados`) já implementado na fase 1 (`estoque_repo::saldo_operacional`).
- **Rationale**: a nuvem já baixa por venda pronta (`0013`); gerar local é redundante e é o que produz
  divergência. Remove a trilha dupla.
- **Nota**: a venda não é mais limitada pelo `estoque` local (`clamp_baixa_venda`); vende a quantidade
  pedida e a nuvem registra divergência se o saldo oficial ficar negativo (ADR-0023). A coluna
  `estoque` e o histórico local são **preservados** (auditoria), mas não alimentam o saldo exibido.

## D3 — Cadastros somente-leitura no PDV (fornecedor, forma de pagamento, destinação)

- **Decisão**: remover do PDV as **telas de edição** (`FornecedorForm`, `FormaPagamentoForm`,
  `DestinacaoForm`) e os **comandos de escrita** (`criar_forma`/`excluir_forma`/… e equivalentes de
  fornecedor/destinação). O PDV mantém **leitura** (pull do sync) para operar a venda (ex.: escolher
  forma de pagamento). No `replica_mapa`, esses recursos ficam **pull-only** (deixam de ser empurrados
  pelo PDV). A **edição** passa a existir na retaguarda (autoridade).
- **Rationale**: fonte única de verdade de cadastro; nenhum caixa origina alteração.
- **Alternativas rejeitadas**: manter edição no PDV com "última escrita vence" (mantém divergência
  entre caixas — o problema que motivou "a nuvem manda").

## D4 — Entrada de nota apenas na nuvem

- **Decisão**: nova RPC `lancar_entrada(...)` (`SECURITY DEFINER`) na nuvem cria o **movimento oficial
  de entrada** (`tipo='entrada'`, `qtd>0`) por item da nota, atualiza custo se aplicável, e (via o
  trigger `0012`) republica o saldo. Tela nova no escritório (`app/entrada`). No PDV: remover
  UI/comandos, **remover `lancamento_entrada`/`item_lancamento` do sync** (`ORDEM_DEPENDENCIA` +
  `replica_mapa` + testes) e **dropar** essas tabelas (migração `m012`) — o histórico fica na nuvem,
  sem tabela morta no PDV.
- **Rationale**: entrada é contábil → pertence à nuvem, junto com saída/estorno. Reusa a republicação.
- **Idempotência**: `sync_uid`/identidade estável por (nota, item) → `on conflict do nothing`.

## D5 — Inventário apenas na nuvem

- **Decisão**: nova RPC `ajustar_inventario(...)` cria o **movimento de ajuste** (`tipo='ajuste'`,
  `qtd = contado − saldo_oficial`) por item contado → republica. Tela nova no escritório
  (`app/inventario`), **responsiva** (contagem no balcão pelo celular, herdando a 011-escritório).
  No PDV: remover `InventarioScanner`/comandos e **dropar** `item_contagem`/`sessao_inventario`
  (locais, fora do sync — migração `m013`).
- **Rationale**: o ajuste é contábil; centraliza na nuvem. A contagem física continua possível no
  balcão via a retaguarda responsiva (tradeoff: exige conexão — ADR-0024).
- **Idempotência**: identidade por (sessão de inventário, item); re-rodar não duplica ajuste.

## D6 — Destinar estoque apenas na nuvem

- **Decisão**: mover a operação de **alocação** (transferência entre "livre" e carimbos de destinação)
  para RPC `destinar_estoque(...)` + tela no escritório. O PDV **lê** os saldos por destinação
  (livre/carimbos) publicados, sem oferecer a operação. A baixa de venda que consome carimbos continua
  sendo efeito da nuvem (ordem de baixa por destinação preservada).
- **Rationale**: carimbos são estoque; seguem o estoque para a nuvem (decisão de clarificação).
- **Nota**: exige publicar os **saldos por destinação** para o PDV (extensão do que a nuvem publica) —
  detalhar no data-model; se a exibição no PDV não for essencial no MVP, pode ser incremento.

## D7 — Dashboard do PDV = lista de vendas do turno aberto

- **Decisão**: `commands_dashboard` deixa de calcular indicadores de estoque (`total_livros`,
  `total_estoque`, `estoque_baixo`) e passa a retornar as **vendas do turno aberto** (identificação,
  valor, hora, situação). A tela inicial (`ResumoCard`/home) renderiza a lista; estado vazio orienta a
  abrir turno. Dados já existem localmente (pedido + turno).
- **Rationale**: indicadores de estoque perderam sentido no caixa; a lista do turno é o que o operador
  precisa. 100% local → funciona offline.

## D8 — Coexistência e rollout

- **Decisão**: a nuvem permanece **idempotente**: se um PDV antigo (não atualizado) ainda empurrar
  `movimento_estoque` de venda, o filtro de push já os descarta; se empurrar cadastro, a LWW resolve.
  Cancelamentos locais **antigos** (feitos antes do fix, já sincronizados, que nunca subiram o
  cancelamento) **não** serão re-empurrados em massa — corrige-se dali pra frente; casos pontuais
  (como o 6327) são tratados manualmente na nuvem. Coordenar **deploy do PDV + retaguarda**.
- **Rationale**: evitar reprocessamento em massa de histórico; o fix é forward-looking.

## D9 — Tradeoff offline (registrar em ADR-0024)

- **Decisão**: **venda/cancelamento/consulta** seguem offline (invariante intacto); **entrada de nota**
  e **inventário** passam a exigir a retaguarda (online). Registrado como decisão de produto no
  **ADR-0024**, aditivo ao invariante de venda offline.
