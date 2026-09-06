# ADR-0025: Turno como unidade operacional — venda push-only, numeração por turno e poda local

## Status

Aceito. (Feature 013. Relaciona-se com ADR-0021 turno de operação, ADR-0023/0024 e a constituição v2.0.0.)

## Contexto

Na fase 3 do "a nuvem manda" (feature 013), o PDV vira operação de **turno corrente**: toda
venda/cancelamento exige turno aberto; o PDV para de acumular histórico; a nuvem é a fonte permanente.
A m009 já criou `pedido.turno_uid` e `pedido.numero_no_turno`, e `turno_operacao` já sincroniza — esta
decisão **força/usa** essa base e adiciona push-only, identidade por máquina e poda local.

## Decisão

1. **Venda push-only**: `pedido`, `item_pedido`, `pagamento_pedido` e `alocacao_venda` deixam de ser
   **puxados** da nuvem (`push_only` no `replica_mapa`); o PDV só **envia** seus fatos. Continua
   descendo apenas o `livro.saldo_publicado` (base do saldo operacional). O **estado do turno**
   (`turno_operacao`) segue bidirecional — o fechamento pode **descer** da nuvem.
2. **Sinal local de incorporação**: o saldo operacional deixa de depender de `estoque_status` **puxado**
   (base do fix v26.8.3). Passa a usar `pedido.ja_sincronizado` — marcador **local**, setado no 1º push
   confirmado e **nunca** limpo pelo cancelamento. O termo `+cancelamento` só conta vendas com
   `ja_sincronizado = 1` (que a nuvem já baixou), evitando dupla contagem offline.
3. **Numeração por turno (Princípio VI)**: o **"Pedido Nº" exibido** passa a ser `pedido.numero_no_turno`
   (1..N por turno). O **`pedido.numero` sequencial contínuo é PRESERVADO** como PK/FK interno — o número
   contínuo do domínio **não é removido**; muda apenas a **exibição**. Assim o Princípio VI ("número de
   pedido sequencial contínuo") é honrado no dado, e a mudança de UX fica **justificada por este ADR**
   (via sancionada pela governança: "violar/alterar um princípio MUST ser justificado por escrito").
   Consequência: o número exibido **não é único global** — buscas/relatórios usam `(turno, numero_no_turno)`.
4. **Identidade do turno por máquina**: `turno_operacao.maquina` (hostname do PC) compõe a identidade e a
   exibição; o mesmo operador em outra máquina/nuvem gera **outro** turno (sem colisão no push). Há **um
   único turno aberto por PDV**: quem logar continua nele; fecha para abrir outro.
5. **Fechamento e reconciliação**: **qualquer usuário do escritório** pode fechar um turno pela nuvem; o
   fechamento **desce** ao PDV. Se o PDV ainda tiver vendas não sincronizadas do turno fechado, ele
   **cria um novo turno** e migra as pendentes — o fechado permanece fechado; **nenhuma venda se perde**.
6. **Retenção/poda local (45 dias)**: o PDV remove turnos **encerrados + sincronizados + com data > 45
   dias** (agregado completo, cascata **filha→pai** para não violar FK — lição do incidente 787/m013). A
   **nuvem retém tudo** permanentemente; a poda é só local e nunca dispara remoção na nuvem.

## Consequências

- (+) Menos sincronização; banco local limitado a ~45 dias; sem colisão de turno entre PDVs; controle
  central no escritório (visão + fechar).
- (−) O "Pedido Nº" deixa de ser único global (mitigado por `(turno, numero_no_turno)`).
- (−) O saldo operacional passa a confiar num marcador local em vez do estado puxado — coberto por testes.
- **Terminologia**: na UI/negócio diz-se **"Fechar/Fechado"** o turno; no domínio/banco o valor é
  **`encerrado`** (`StatusTurno::Encerrado`, `turno_operacao.status`). São o mesmo conceito — toda
  comparação de string usa `'encerrado'`.
- Invariante offline (v2.0.0) **reforçado**: venda/cancelamento 100% offline; push-only só sobe fatos.
