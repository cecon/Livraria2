# ADR-0023: Estoque oficial na nuvem por venda pronta

## Status

Aceito.

## Contexto

O PDV continua offline-first para operar turno, venda e cancelamento localmente, mas sua
responsabilidade contabil sobre estoque deve ser reduzida. O estoque oficial precisa ser
profissionalizado primeiro na nuvem, preservando o saldo atual de producao como ponto de
partida e evitando que historico antigo seja reprocessado.

Hoje parte do fluxo baixa estoque no cliente que registra a venda. Isso cria risco de
duplicidade, drift silencioso quando o cache local diverge e regras diferentes entre PDV e
escritorio.

Esta decisao complementa ADR-0008 e substitui, para a nuvem, a decisao de limitar baixa de
venda ao estoque cacheado descrita na ADR-0018.

## Decisao

O estoque oficial passa a ser efeito da nuvem, gerado a partir de eventos de venda pronta e
cancelamento:

- Uma venda so afeta estoque oficial quando for marcada como `estoque_status = 'pronta'`.
- Ao receber uma venda pronta, a nuvem cria uma unica `saida_venda` por item, pela quantidade
  total vendida.
- Se o saldo oficial for insuficiente, a baixa ainda ocorre pela quantidade total e o saldo pode
  ficar negativo; a divergencia fica registrada para tratamento administrativo.
- Ao cancelar uma venda incorporada, a nuvem cria estornos vinculados aos movimentos originais,
  uma unica vez.
- O estoque atual de producao e preservado como baseline. A migracao captura saldos de partida
  para auditoria, mas nao recalcula nem reescreve movimentos antigos.
- O PDV deve sincronizar venda/cancelamento como fatos operacionais. Ele nao deve gerar
  movimentos oficiais de estoque por venda ou cancelamento.
- Produto inexistente nao e um caso valido de venda; se aparecer por corrupcao de dados, a nuvem
  deve rejeitar ou registrar divergencia sem criar baixa sem livro.

## Consequencias

- A fonte contabil do estoque fica centralizada na nuvem.
- O PDV pode continuar vendendo offline com um saldo operacional simples, calculado a partir do
  saldo publicado e dos eventos locais ainda nao sincronizados.
- Relatorios e rotinas administrativas devem ler o saldo oficial da nuvem.
- A migracao e os gatilhos precisam ser idempotentes, porque o mesmo evento pode ser sincronizado
  ou reprocessado mais de uma vez.
- Deploy em producao exige backup/snapshot antes da migracao e validacao de reaplicacao em
  ambiente equivalente.

## Nota — republicacao do saldo para o PDV (migracao 0012)

O saldo oficial so retorna ao PDV se o produto for **republicado**: `vw_produto_pdv` usa
`livro.sincronizado_em` como marca de publicacao e o pull do PDV so re-busca livros com
`sincronizado_em > cursor`. Sem bumpar `sincronizado_em` quando o estoque muda, o `saldo_publicado`
nunca desce de volta (o PDV mostra "saldo op. 0" apos atualizar, porque a coluna local nasce em 0 e
nunca e reescrita). A migracao `0012_republica_saldo_pdv.sql` fecha o loop:

- Trigger `trg_mov_republica_livro` em `movimento_estoque` (insert/update/delete) faz
  `update livro set sincronizado_em = now()` do livro afetado — qualquer mudanca de estoque oficial
  (venda pronta, estorno de cancelamento, ajuste manual) republica o produto.
- Backfill unico (`update livro set sincronizado_em = now()`) destrava os PDVs ja atualizados sem
  exigir novo build: no proximo sync eles re-baixam `saldo_publicado` via o caminho incondicional
  de `replica_sync` (nao passa por LWW).

Correcao 100% na nuvem; o PDV nao volta a ser fonte contabil de estoque.
