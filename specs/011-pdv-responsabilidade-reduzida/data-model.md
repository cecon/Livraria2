# Data Model: PDV com Responsabilidade Reduzida

## Existing Entities Used

### livro

Produto canonico/publicado para venda.

**Key fields**: `sync_uid`, `codigo`, `titulo`, `preco_centavos`, `ativo`, `excluido_em`.

**Rules**:
- Venda valida referencia apenas produto conhecido/publicado.
- Produto inativo vendido por evento offline gera divergencia, mas nao apaga a venda.

### pedido

Venda recebida pela nuvem.

**Existing fields**: `sync_uid`, `numero`, `cliente`, `turno`, `data`, `total_centavos`, `cancelado`, `cancelado_em`, `operador_uid`, `origem`, sync metadata.

**New/clarified fields**:
- `estoque_status`: `rascunho` | `pronta` | `incorporada` | `cancelada_estornada` | `divergente`.
- `estoque_pronta_em`: timestamp em que a venda foi marcada como completa/pronta.
- `estoque_incorporada_em`: timestamp em que a baixa oficial foi gerada.
- `estoque_estornada_em`: timestamp em que o cancelamento foi estornado.

**State transitions**:
- `rascunho` -> `pronta`: venda tem dados minimos completos.
- `pronta` -> `incorporada`: movimentos oficiais de `saida_venda` gerados.
- `incorporada` -> `cancelada_estornada`: cancelamento estornou movimentos originais.
- qualquer estado processavel -> `divergente`: ocorreu inconsistencia administrativa visivel.

### item_pedido

Item vendido.

**Existing fields**: `sync_uid`, `pedido_uid`, `codigo`, `titulo`, `preco_centavos`, `qtd`, sync metadata.

**New/clarified fields**:
- `livro_uid`: referencia explicita opcional/necessaria para o produto conhecido na nuvem, quando a sincronizacao ja resolve o produto por `sync_uid`.

**Rules**:
- `qtd` de venda deve ser positiva no fluxo aceito.
- Itens de venda pronta devem resolver para produto conhecido/publicado.

### movimento_estoque

Ledger oficial de estoque.

**Existing fields**: `sync_uid`, `livro_uid`, `tipo`, `qtd`, `custo_unit_centavos`, `fornecedor`, `motivo`, `referencia`, `criado_em`, sync metadata.

**New/clarified fields**:
- `pedido_uid`: venda que gerou o movimento, quando derivado de venda/cancelamento.
- `item_pedido_uid`: item que gerou o movimento, quando aplicavel.
- `movimento_origem_uid`: movimento de saida original que esta sendo estornado, quando `tipo = estorno_venda`.

**Rules**:
- `saida_venda`: `qtd` negativa e igual a quantidade vendida integral.
- `estorno_venda`: `qtd` positiva e igual ao valor absoluto da saida original.
- Movimentos derivados de venda/cancelamento sao gerados pela nuvem, nao por cliente.
- Deduplicacao deve impedir mais de uma saida por item de venda e mais de um estorno por movimento original.

## New Entities

### divergencia_estoque

Registro administrativo de inconsistencias detectadas pela automacao oficial.

**Fields**:
- `sync_uid`: identidade da divergencia.
- `pedido_uid`: venda relacionada.
- `item_pedido_uid`: item relacionado, quando aplicavel.
- `livro_uid`: produto relacionado, quando aplicavel.
- `tipo`: `saldo_negativo`, `produto_inativo`, `venda_invalida`, `processamento_estoque`.
- `descricao`: texto curto para operador administrativo.
- `saldo_antes`: saldo oficial antes da baixa, quando aplicavel.
- `qtd_evento`: quantidade que causou a divergencia, quando aplicavel.
- `status`: `aberta` | `resolvida` | `ignorada`.
- `criado_em`, `resolvida_em`, `resolvida_por`.

**Rules**:
- Divergencia nao apaga venda e nao desfaz movimento automaticamente.
- Correcao historica ocorre por ajuste administrativo explicito.

### saldo_partida_producao

Marco de ativacao da nova automacao preservando o saldo atual.

**Fields**:
- `sync_uid`: identidade do marco.
- `livro_uid`: produto.
- `saldo`: saldo preservado na ativacao.
- `capturado_em`: timestamp do marco.
- `origem`: `producao`.

**Rules**:
- Criado uma vez por produto ativo no momento de ativacao.
- Nao e recomputado silenciosamente.

## Derived Views

### vw_saldo_livro

Continua a expor saldo oficial por produto a partir de `movimento_estoque`.

**Clarification**:
- Pode retornar saldo negativo.
- E a base para saldo publicado ao PDV.

### vw_produto_pdv

Visao proposta para publicacao ao PDV.

**Fields**:
- `livro_uid`, `codigo`, `titulo`, `autor`, `preco_centavos`, `ativo`, `saldo_publicado`.

**Rules**:
- Inclui apenas produtos vendaveis/publicados.
- `saldo_publicado` vem da nuvem; o PDV ajusta localmente por pendencias.

