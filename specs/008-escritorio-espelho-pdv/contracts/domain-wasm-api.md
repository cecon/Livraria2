# Contrato — API do domínio via WASM (`@livraria/domain`)

O crate `livraria-domain-wasm` expõe o domínio puro para JS via `wasm-bindgen`/`serde-wasm-bindgen`. O wrapper TS `@livraria/domain` oferece tipos e ergonomia. **A superfície abaixo é a fronteira** — a lógica não é reimplementada no JS; apenas chamada.

## Princípios do contrato

- **Puro e determinístico**: mesmas entradas → mesmas saídas; sem I/O, sem relógio (tempo entra como dado, ex.: ISO strings, hora `u32`).
- **Dinheiro = inteiro de centavos** (`i64`/`number`), nunca float.
- **Tipos de dados** trafegam como objetos serde (JSON) — o adapter Supabase monta/desmonta a partir das linhas PostgREST.

## Funções expostas (mapeadas do domínio)

| Área | Função (domínio) | Uso no Escritório |
|---|---|---|
| Dinheiro | `parse_brl`, `to_brl`, `soma`, `diferenca_piso_zero` | exibição/entrada pt-BR, somas |
| Estoque | `recompor_ledger(movimentos ordenados) -> (saldo, custo_medio)` | **custo médio** e conferência de saldo |
| Estoque | `custo_medio_apos_entrada(...)`, `derivar_custos(...)`, `aplicar_ajuste(...)`, `diferenca_contagem(...)` | entrada/ajuste/inventário |
| Estoque | `clamp_baixa_venda(qtd, saldo) -> baixa` **(regra elevada, ADR-0018)** | clamp da baixa na venda + flag `baixa < qtd` |
| Estoque | `baseline_saldo_inicial(estoque, soma_mov) -> delta` **(regra elevada, ADR-0017)** | completar ledger antes de operar |
| Pedido | `Pedido::total/restante/troco`, `validar_conclusao(dinheiro_forma_id)` | totais/troco/validação de conclusão |
| Pedido | `pode_cancelar_venda(data_venda, hoje)` | regra de cancelamento |
| Alocação | `alocar_venda(carimbos, livre, qtd)`, `alocar_perda(...)`, `validar_transferencia(...)` | destinações (006) |
| Inventário | `contagem_efetiva(modo, contada)`, `resumir(itens)` | contagem/resumo |
| Lançamento | `total_nota`, `pode_finalizar(status, tem_fornecedor, num_itens)` | nota de entrada |
| Pagamento | `Turno::de_hora(hora)`, `nome_normalizado`, `ChaveSistema` | forma de pagamento/turno |
| Sync | `decidir_aplicacao(local, remoto) -> Decisao`, `e_orfao`, `saldo_dos_movimentos` | convergência (LWW) idêntica |
| **Turno** *(novo)* | `abrir(operador, caixa_inicial?)`, `pode_registrar_venda(status)`, `proximo_numero(qtd_no_turno) -> n`, `resumir_fechamento(pagamentos_do_turno) -> resumo`, `encerrar(resumo, conferido) -> {esperado, conferido, diferenca}` | ciclo abrir/vender/encerrar; Pedido Nº por turno; fechamento de caixa |

> `clamp_baixa_venda` e `baseline_saldo_inicial` são adicionadas ao domínio (hoje moram no adapter SQL); o PDV passa a chamá-las também — refactor sem mudança de comportamento, coberto por testes.

## Teste de conformidade (paridade)

Para um conjunto de vetores de entrada, o resultado da chamada nativa (Rust/PDV) e da chamada WASM (Escritório) **deve ser bit-a-bit igual** para: `recompor_ledger`, `custo_medio_apos_entrada`, `clamp_baixa_venda`, `validar_conclusao`, `alocar_venda/alocar_perda`, `contagem_efetiva/resumir`, `decidir_aplicacao`, `proximo_numero`, `resumir_fechamento`, `encerrar`.
