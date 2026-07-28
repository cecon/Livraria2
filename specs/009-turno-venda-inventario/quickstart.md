# Quickstart — Validação da Feature 009

Guia de validação ponta-a-ponta (não é código de implementação). Prova os cenários da spec e os SC.

## Pré-requisitos

- Workspace da 008 montado (`npm ci` na raiz; `@livraria/ui` e `@livraria/domain` presentes em `packages/`).
- Migrations aplicadas: **SQLite `m009`** (PDV) e **nuvem `0010_turno.sql`** (Supabase) — idempotentes
  (re-aplicar não duplica).
- WASM regenerado pelo CI com os novos wrappers (venda + turno).
- Escritório rodando (Docker/dev) com login usuário/senha do #15; PDV em `tauri dev`.

## Cenário 1 — Turno: abrir, numerar, encerrar (US1, SC-001/002)

1. No Escritório, sem turno aberto, ir em **Venda** → deve **bloquear** e oferecer "Abrir turno" (FR-002).
2. **Abrir turno** com caixa inicial `R$ 100,00`.
3. Concluir 3 vendas → Pedido Nº do turno deve ser **1, 2, 3** (`numero_no_turno`), reiniciando em relação a
   outros turnos.
4. Tentar **abrir um segundo turno** com o mesmo operador nesta origem → **bloqueado** (D7/clarify Q3).
5. **Encerrar turno**: conferir que o fechamento mostra **totais por forma** (informativos) e a **conferência
   do dinheiro** = `100,00 + Σ vendas em dinheiro`; digitar o conferido → ver a **diferença** (pode ser ≠ 0 sem
   impedir). Turno fica **encerrado** e recusa novas vendas.
6. **Esperado**: numeração por turno sem colisão com o PDV (SC-001); fechamento confere com as vendas (SC-002).

## Cenário 2 — Venda idêntica ao PDV (US2, SC-003)

1. Com turno aberto, montar um carrinho e concluir uma venda no Escritório.
2. Executar a **mesma venda** (mesmos itens/pagamentos) no PDV.
3. **Esperado**: estoque baixado igual (`clamp_baixa_venda`), custo, total e **troco** idênticos
   (`validar_conclusao`/`troco` via WASM == nativo). Estoque nunca negativo; `baixa < qtd` sinalizado.

## Cenário 3 — Inventário na nuvem (US3, SC-004)

1. No Escritório, abrir sessão de inventário **parcial**, contar alguns livros (digitação e/ou câmera).
2. Fechar → o sistema reconcilia (`contagem_efetiva` parcial: só ajusta contados) e grava **ajustes** em
   `movimento_estoque`.
3. Repetir uma contagem equivalente no PDV.
4. **Esperado**: **mesmos ajustes** nas duas pontas (SC-004); no modo **total**, livros não contados contam 0.

## Cenário 4 — Ida-e-volta e sincronização (US1/US2, SC-001/003)

1. Venda concluída no Escritório → após sync, aparece no PDV com o mesmo `numero_no_turno` e valores.
2. Ajuste de inventário do Escritório → aparece como `movimento_estoque` no PDV; saldo converge.
3. **Esperado**: convergência por `sync_uid`/LWW; `turno_operacao` sincroniza **antes** de `pedido`.

## Cenário 5 — Export de relatórios (US4, SC-006)

1. Emitir um relatório no Escritório → **Exportar Excel**, **Exportar PDF**, **WhatsApp**.
2. **Esperado**: arquivo/― resumo com os **mesmos números** do PDV para o mesmo período.

## Testes automatizados (US4, SC-005)

- `cargo test` no domínio: `turno_operacao` (abrir/proximo_numero/fechamento só-dinheiro/encerrar) e reuso de
  venda/inventário — roda **sem UI/banco**.
- **Conformidade** nativo↔WASM (`tests/conformance.rs`) para turno e venda (mesmo input → mesmo output).
- **Ida-e-volta** PDV↔nuvem, **acesso** (RLS `to authenticated`) e **convergência concorrente** (LWW).

## Gate de constituição (checar antes de integrar)

- Arquivos de lógica novos ≤ **300 linhas** (telas decompostas).
- `m009` e `0010_turno.sql` **idempotentes** (re-aplicar não quebra/duplica).
- Nenhum `service_role` no cliente; operações exigem login (RLS).
- ADRs saneados: **0022** (renumeração do WASM) e **0021 corrigido** (`0010_turno.sql`).
