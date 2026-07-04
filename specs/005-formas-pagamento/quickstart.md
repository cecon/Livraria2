# Quickstart — Validação ponta a ponta: Cadastro de formas de pagamento

Guia de validação (não implementação). Pré-requisitos: toolchain Rust 1.93, Node + **npm** (projeto npm-only — não usar pnpm/npm 11), app Tauri rodando.

## 0. Build e testes do núcleo

```sh
cd src-tauri && cargo test
```

Esperado verde, incluindo:
- **Migração `m006`** sobre SQLite temporário **populado**: Σ por venda e Σ global por forma idênticos antes/depois; reaplicar não duplica (idempotente); `foreign_key_check` limpo. Caso de base nova (sem pedidos) também converge. **Falha simulada** (Σ divergente): rollback deixa `val_*` intactas e `aplicar()` retorna `Err` (FR-016a).
- **Domínio**: `Pagamentos::pago()` = Σ; troco válido só até o valor na forma Dinheiro; `pode_excluir`/`pode_desativar` respeitam `de_sistema` e `em_uso`; normalização de nome (caixa/acentos/trim) deduplica rótulos (FR-010/D9).
- **Relatórios**: resumo dinâmico reconcilia (Σ formas = soma dos totais pagos).

## 1. Migração sem prejuízo (US3 / SC-002, SC-003, SC-006)

1. Partindo de uma base **anterior** (com `pedido.val_*` e vendas reais/importadas), anote os totais por forma de um período no relatório atual.
2. Suba o app com o novo binário → a `m006` roda no boot.
3. Gere o relatório do **mesmo período**: total geral e total por forma idênticos; o antigo "Cartão" agora aparece como **Crédito**.
4. Reabra o app (reaplica) → nada muda (idempotência).

## 2. PDV com as novas formas (US1 / SC-001)

1. Abra o PDV, adicione um item de R$ 100,00.
2. Confirme que aparecem, na ordem: **Crédito, Débito, Dinheiro, PIX, PIX Igreja, Ministério, Vale Presente**.
3. Lance R$ 60,00 em **Crédito** e R$ 40,00 em **Débito**; conclua.
4. Em "Lista de vendas"/relatório, a venda mostra os dois recebimentos separados, somando R$ 100,00.
5. Teste o troco: pague R$ 100,00 só em **Dinheiro** numa venda de R$ 90,00 → troco R$ 10,00; tentar gerar troco a partir de outra forma é bloqueado.

## 3. Cadastro de formas (US2 / SC-004, SC-005)

1. Acesse a tela **Formas de pagamento**.
2. **Criar**: adicione "Boleto" (ativa) → aparece no PDV na posição definida.
3. **Renomear**: mude "Crédito" para "Cartão de Crédito" → vendas novas e antigas exibem o novo rótulo (mesma identidade).
4. **Reordenar**: troque a ordem de duas formas → reflete no PDV e no relatório.
5. **Desativar**: desative "Boleto" → some do PDV, mas vendas que já o usaram continuam exibindo-o no histórico.
6. **Excluir bloqueado**: tente excluir uma forma **já usada** (ex.: Crédito) ou **de sistema** (Dinheiro) → bloqueado, com orientação para desativar (e formas de sistema nem desativam).
7. **Excluir permitido**: crie "Temp" sem usar e exclua → some do cadastro.
8. **Nome duplicado normalizado**: com "Boleto" ativo, tente criar "boleto" ou " BOLETO " → bloqueado (comparação insensível a caixa/acentos, FR-010).
9. **Reativação conflitante**: desative "Boleto", crie outra forma "Boleto", tente **reativar** a antiga → bloqueado com mensagem pedindo renomear antes (FR-007).

## 4. UI

```sh
npm run test       # Vitest: venda.ts parametrizado por formas; resumo dinâmico
npm run tauri dev  # validação manual dos passos 2–3
```

## Critérios de aceite cobertos

- SC-001 (venda multi-forma em 1 fluxo), SC-002/SC-003 (migração sem perda/idempotente), SC-004 (CRUD < 1 min), SC-005 (exclusão de forma usada bloqueada), SC-006 (relatórios históricos idênticos).
