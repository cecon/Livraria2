# Quickstart — Validação: Movimentação de Estoque & Inventário

Guia de validação ponta a ponta. Detalhes de modelo/contrato em [data-model.md](data-model.md) e
[contracts/tauri-commands.md](contracts/tauri-commands.md). Implementação fica em `tasks.md`.

## Pré-requisitos

- Stack da 001 funcionando (Tauri + SeaORM/SQLite + React). Sem novas dependências.
- Base com alguns livros (acervo migrado ou cadastro manual). Leitor de código de barras opcional —
  qualquer teclado serve (basta digitar o código + Enter no campo de bipagem).

## Setup

```bash
# núcleo Rust (domínio + adapters)
cd src-tauri && cargo test            # regras puras + adapters com SQLite temporário
cd .. && npm install                  # UI
npm run tauri dev                     # app desktop
```

No primeiro boot após a migration `m_estoque`, o passo `gerar_saldos_iniciais` cria um movimento
`saldo_inicial` por livro existente.

## Cenários de validação

### 1. Saldo inicial e invariante (FR-006, SC-001)
1. Abrir o app numa base com livros migrados.
2. Conferir, no extrato de qualquer livro (`extrato_livro`), uma linha `saldo_inicial` igual ao estoque.
3. **Esperado**: para todo livro, soma das `qtd` dos movimentos == `estoque` exibido (diferença zero).

### 2. Entrada de mercadoria com custo médio (US1, FR-010/015, SC-002)
1. Livro com estoque 4 e custo médio 0.
2. `registrar_entrada` { qtd: 10, fornecedor: "Editora X", custoUnitCentavos: 1250 }.
3. **Esperado**: estoque 14; movimento `entrada` (+10, custo 1250, "Editora X"); `custo_medio_centavos` =
   `round_half_up((4*0 + 10*1250)/14)` = 893. Concluído em < 30 s.
4. Repetir informando `custoTotalCentavos` em vez de unitário → servidor deriva o unitário (total/qtd).

### 3. Ajuste avulso com motivo e não-negativo (US3, FR-040/043)
1. Livro com estoque 7 → `registrar_ajuste` { qtd: -2, motivo: "quebra" } → estoque 5, movimento `ajuste`.
2. `registrar_ajuste` sem motivo → erro `MOTIVO_OBRIGATORIO`.
3. `registrar_ajuste` { qtd: -99 } num livro com estoque 5 → erro `ESTOQUE_NEGATIVO` (estoque permanece 5).

### 4. Inventário parcial por bipagem (US2, FR-020..030, SC-003/004)
1. `inventario_abrir` { modo: "parcial", rotulo: "Gaveta A" }.
2. `inventario_bipar` 3× com o `codigoBarras` de um livro → `qtdContada` = 3 (cada bipada < 1 s).
3. Livro com estoque 5 no sistema e contagem 4 → `inventario_revisao` mostra `{ qtdSistema:5, qtdContada:4, diferenca:-1 }`.
4. `inventario_fechar` → movimento `contagem` (-1) só para os livros contados; **livros não bipados ficam
   intactos** (SC-004). Estoque do livro vira 4 (= contado).

### 5. Código desconhecido vira pendência (US5, FR-023/051, SC-007)
1. Numa sessão, bipar um `codigoBarras` inexistente.
2. **Esperado**: contagem não trava; `inventario_pendencias` lista o código com a quantidade lida.
3. Cadastrar o livro e `resolver_pendencia` → some da lista.

### 6. Inventário total zera não-contados (FR-026)
1. `inventario_abrir` { modo: "total" }, bipar parte do acervo.
2. `inventario_fechar` sem `confirmarTotal` → aviso de que livros não bipados serão zerados.
3. Com `confirmarTotal: true` → livros ativos não bipados recebem ajuste para 0.

### 7. Venda emite movimento (FR-003)
1. Registrar uma venda (fluxo da 001) de um livro.
2. **Esperado**: estoque baixa como antes **e** surge movimento `saida_venda` (ref = nº do pedido) no extrato;
   soma dos movimentos continua batendo com o estoque.

## Critérios de aceite (resumo)
- SC-001 reconciliação zero; SC-002 entrada < 30 s; SC-003 bipagem < 1 s; SC-004 parcial não afeta fora do
  escopo; SC-005 extrato bate com estoque; SC-006 divergências registradas; SC-007 nenhuma pendência perdida.
- `cargo test` cobre as regras puras (custo médio, ajuste não-negativo, diferença de contagem, modo total)
  sem UI nem banco.
