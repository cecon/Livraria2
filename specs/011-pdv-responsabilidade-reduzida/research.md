# Research: PDV com Responsabilidade Reduzida

## Decision: Estoque oficial reage a venda completa/pronta

**Decision**: A nuvem gera movimentos oficiais de estoque somente quando a venda estiver marcada como completa/pronta.

**Rationale**: Pedido, itens e pagamentos podem chegar em escritas separadas durante sync. Processar antes do marco de completude pode gerar baixa parcial, duplicada ou baseada em venda incompleta.

**Alternatives considered**:
- Processar no insert de `item_pedido`: rejeitado por risco de venda parcial.
- Processar por rotina manual: rejeitado porque deixa a baixa oficial dependente de operador.

## Decision: Baixa integral mesmo com saldo insuficiente

**Decision**: Se a venda valida referencia produto conhecido/publicado, a nuvem baixa a quantidade integral vendida, mesmo que o saldo oficial fique negativo, e registra divergencia.

**Rationale**: A venda fisica aconteceu. O maior risco operacional e esconder a saida por saldo antigo/incorreto. Saldo negativo e visivel e corrigivel; venda sem baixa e drift silencioso.

**Alternatives considered**:
- Baixar so ate zero: rejeitado porque recria o drift silencioso.
- Bloquear incorporacao da venda: rejeitado porque venda offline nao pode ser apagada ou travada depois.

## Decision: Cancelamento estorna movimentos originais

**Decision**: Cancelamento de venda incorporada estorna exatamente os movimentos oficiais gerados pela venda original.

**Rationale**: O estorno precisa seguir o fato contabil registrado, nao o saldo atual nem uma recomputacao dos itens. Isso garante auditoria e idempotencia.

**Alternatives considered**:
- Estornar itens do pedido: rejeitado porque pode divergir dos movimentos originais se regra evoluir.
- Sempre criar pendencia manual: rejeitado por burocratizar cancelamento comum.

## Decision: Preservar saldo atual de producao

**Decision**: O saldo atual em producao e o saldo de partida. A ativacao da automacao nao reprocessa historico para alterar saldos atuais.

**Rationale**: Producao ja tem saldos operacionais que precisam ser respeitados. Reprocessar historico poderia mudar estoque sem conferencia fisica e criar surpresa para a operacao.

**Alternatives considered**:
- Reprocessar todo historico: rejeitado por risco alto de alterar producao.
- Ignorar historico sem baseline explicito: rejeitado porque a auditoria da virada ficaria fraca.

## Decision: Divergencia como item administrativo

**Decision**: Produto inativo, saldo negativo gerado por venda e outras inconsistencias oficiais viram divergencias rastreaveis para conferencia administrativa.

**Rationale**: A nuvem deve ser a fonte oficial e tambem o lugar de saneamento. Divergencias precisam ser visiveis, filtraveis e resolviveis por ajuste ou correcao administrativa.

**Alternatives considered**:
- Falhar a venda sincronizada: rejeitado porque a venda local ja ocorreu.
- Corrigir automaticamente: rejeitado porque pode esconder erro de cadastro ou contagem.

## Decision: Triggers/funcoes SQL na borda de persistencia

**Decision**: Implementar a automacao oficial em funcoes/triggers idempotentes de Postgres, com indices unicos de deduplicacao.

**Rationale**: Hoje o Escritorio grava `movimento_estoque` manualmente. Centralizar no banco evita regra duplicada entre clientes e garante que qualquer origem autenticada siga o mesmo comportamento.

**Alternatives considered**:
- Manter regra no TypeScript: rejeitado porque o PDV/sync teria de duplicar regra.
- Criar backend HTTP dedicado: rejeitado por YAGNI neste escopo; Supabase/PostgREST ja e a borda adotada.

