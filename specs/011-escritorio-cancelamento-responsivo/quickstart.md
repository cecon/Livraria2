# Quickstart — Validação: cancelar/reabrir venda + responsivo (feature 011)

Guia de validação ponta-a-ponta. Prova US1–US3 e os edge cases. Sem código de implementação.

## Pré-requisitos

- Migração `0010_cancelar_venda` aplicada (RPC `cancelar_venda`).
- WASM `@livraria/domain` com `pode_cancelar_venda` (já existe).
- Escritório rodando (login admin) + um turno aberto; PDV disponível para o teste de sync.

## Testes automatizados (antes de tocar produção)

```bash
cargo test -p livraria-domain pedido        # janela de 5 dias (pode_cancelar_venda)
# Conformância estorno nativo(PDV) ↔ SQL(nuvem): mesmo pedido, mesmo efeito (estoque e carimbo)
# Idempotência: rodar cancelar_venda 2× → 1 estorno; simular concorrência PDV+nuvem → 1 estorno
```
**Esperado**: verde; o `sync_uid` do estorno é idêntico nos dois lados (dedupe no merge).

## US1 — Cancelar venda (estoque + carimbo)

1. Registre uma venda hoje: 2 unidades do livro X (estoque cai 2).
2. Em **Venda → Lista de vendas**, **Cancelar** a venda. Confirme.
   - **Esperado**: estoque de X **volta +2** (igual ao pré-venda — SC-001); a venda fica **cancelada**
     no histórico e **some** dos totais do dia (SC-005).
3. Se a venda consumiu carimbo de uma destinação, o **saldo da destinação volta** ao valor anterior (SC-002).
4. **Idempotência**: clique Cancelar de novo (ou reenvie) → **nada muda** (SC-004).
5. **Sync**: sincronize o PDV → a venda aparece cancelada e o estoque devolvido no PDV (e vice-versa).

## US1 — Janela

1. Tente cancelar uma venda com **> 5 dias** → **recusado** com mensagem clara (SC-003).

## US2 — Responsivo (celular)

1. Abra o Escritório num viewport de **~360px** (retrato). Em **cada** tela principal:
   - **Sem rolagem horizontal** (SC-006); o menu vira **hambúrguer/drawer**.
   - Tabelas viram **cards** legíveis; grids empilham.
2. **Caixa no celular**: busque um livro, adicione ao carrinho, informe o pagamento (input maquininha +
   botão "restante"), **conclua** — em **< 2 min** (SC-007).
3. **Desktop**: repita as tarefas no desktop → **sem regressão** (mesmos passos — SC-008).

## US3 — Reabrir (clonar)

1. Numa venda dentro da janela, **Reabrir**.
   - **Esperado**: a original fica **cancelada** (estoque devolvido) e o **caixa abre com os mesmos
     itens** carregados.
2. Ajuste e **conclua** → existe **uma** venda válida (a nova); a antiga segue cancelada.
3. **Desista** após reabrir (saia sem concluir) → original segue cancelada, **nenhuma** venda nova.

## Critérios de aceite (resumo)

| SC | Onde é provado |
|---|---|
| SC-001 estoque volta exato | US1 passo 2 |
| SC-002 carimbo volta exato | US1 passo 3 |
| SC-003 janela 5 dias | US1/Janela |
| SC-004 idempotência (incl. sync) | US1 passo 4 + testes |
| SC-005 some do total, fica no histórico | US1 passo 2 |
| SC-006 sem rolagem horizontal no celular | US2 passo 1 |
| SC-007 venda no celular < 2 min | US2 passo 2 |
| SC-008 desktop sem regressão | US2 passo 3 |
