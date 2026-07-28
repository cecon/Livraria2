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
