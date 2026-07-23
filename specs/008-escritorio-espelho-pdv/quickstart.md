# Quickstart — Validação da feature 008 (Escritório espelho do PDV)

Guia de validação end-to-end. Não contém implementação — só como provar que a paridade funciona. Referências: [plan.md](./plan.md), [contracts/](./contracts/), [data-model.md](./data-model.md).

## Pré-requisitos

- Workspace instalado (npm workspaces) com `@livraria/ui` e `@livraria/domain` (WASM) buildados.
- Crate `livraria-domain` compilando nativo (PDV) e para `wasm32` (`wasm-pack`).
- Supabase da feature 007 acessível; usuário do Escritório logado (RLS `to authenticated`).
- Container do Escritório rodando (Docker local, feature 007) — porta externa não óbvia.

## Cenário 1 — Paridade visual (US1 / SC-001, SC-004)

1. Abrir PDV e Escritório lado a lado.
2. Conferir a barra lateral: 10 itens, mesma ordem/rótulo/ícone (ver `contracts/ui-parity.md`).
3. Abrir Cadastro, Pesquisa, Fornecedores, Relatórios nos dois: layout, cores, tipografia, estados (carregando/vazio/erro) idênticos.
4. Alternar tema claro/escuro nos dois — mesma paleta.

**Esperado**: nenhuma tela "de aparência antiga"; navegação 100% coincidente.

## Cenário 2 — Paridade funcional de retaguarda (US2 / SC-003, SC-006)

1. **Cadastro/preço**: criar/alterar um livro no Escritório → `livro.upsert` por `sync_uid`. Sincronizar o PDV → o livro aparece igual (e vice-versa).
2. **Lançamento**: lançar nota de entrada no Escritório (fornecedor + itens) → gera `lancamento_entrada`/`item_lancamento`/`movimento_estoque(entrada)`.
3. **Pesquisa**: abrir o livro no Escritório → saldo de `vw_saldo_livro` e **custo médio via WASM** conferem com o PDV para o mesmo livro/período.
4. **Relatórios**: mesmo período nos dois → números batem.

**Esperado**: mesmos dados nas duas pontas; saldo e custo idênticos; centavos sem divergência.

## Cenário 3 — Turno de operação (US4) — precede a Venda

1. Com nenhum turno aberto, tentar iniciar uma venda → sistema **exige abrir turno** (bloqueia).
2. **Abrir turno** (informar caixa inicial opcional) → indicador mostra turno aberto do operador.
3. Registrar 3 vendas → recebem **Pedido Nº 1, 2, 3** dentro do turno.
4. Abrir um turno no PDV em paralelo, registrar vendas → também numeram 1..n **no próprio turno**; após sync, **sem colisão** (SC-007).
5. **Encerrar** o turno → **fechamento de caixa**: totais por forma de pagamento, qtd de vendas, esperado vs. conferido, diferença (SC-008). Turno encerrado **não aceita** novas vendas.

**Esperado**: venda só dentro de turno aberto; numeração por turno sem colisão entre PDV/Escritório; resumo de fechamento confere.

## Cenário 4 — Venda completa na nuvem (US3)

1. Com **turno aberto**, no Escritório, montar carrinho, escolher forma de pagamento, concluir.
2. Verificar gravação: `pedido`/`item_pedido`/`pagamento_pedido` + `saida_venda` por item.
3. Caso de estoque insuficiente: `baixa = min(qtd, saldo)` (clamp do domínio) e **sinalização** de `baixa < qtd` (sem bloquear, sem saldo negativo).
4. Conferir total/troco = `Pedido::total/troco` (mesmo do PDV).

**Esperado**: venda registrada na nuvem; saldo/custo/valores iguais ao que o PDV produziria.

## Cenário 5 — Inventário na nuvem (US3)

1. Iniciar contagem no Escritório (digitação/câmera), contar alguns itens.
2. Finalizar → movimentos de `ajuste` gravados; `resumir` exibe diferenças.
3. Conferir saldo pós-ajuste em `vw_saldo_livro`.

**Esperado**: itens/ajustes conferem com o que o PDV registraria para a mesma contagem.

## Cenário 6 — Conexão e concorrência (FR-010, FR-014)

1. Simular perda de conexão → tentativa de gravação **bloqueada** com aviso "sem conexão"; PDV segue operando offline.
2. Editar o mesmo livro no PDV e no Escritório quase juntos → vence o `atualizado_em` mais recente (hora de servidor), sem perda silenciosa.

## Cenário 7 — Conformidade de regra (teste automatizado, DRY)

- Rodar a suíte de **paridade PDV↔WASM**: para vetores de entrada, `recompor_ledger`, `clamp_baixa_venda`, `validar_conclusao`, `custo_medio_apos_entrada`, `alocar_venda`, `contagem_efetiva`, `decidir_aplicacao`, `proximo_numero`, `resumir_fechamento`, `encerrar` produzem saída **idêntica** nativo vs WASM.
- Rodar `cargo test` do domínio (sem UI/banco) — verde após elevar as regras (ADR-0017/0018) ao domínio, sem mudança de comportamento no PDV.
