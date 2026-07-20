# Quickstart — Validação da sincronização (007)

Guia de validação ponta a ponta. Prova os cenários P1 da [spec](spec.md): escritório com notebook desligado, PDV offline, e convergência idempotente. **Não** contém código de implementação (isso é `tasks.md`).

## Pré-requisitos

- Base na nuvem provisionada (Supabase; segredos na Memória do Projeto no Notion), com schema espelho + **RLS por usuário** aplicados e **Supabase Auth** habilitado (ao menos 1 usuário do escritório).
- `m008` aplicada no SQLite local (colunas de sync + backfill de `sync_uid` + índices de dedup).
- **Seed inicial** executado (`seed_inicial`) — histórico completo já na nuvem (D13).
- App do escritório publicado (Portainer/nginx), com **login** funcionando.
- **Emenda 1.1.0 e ADR-0015/0016 já registrados** (gate de governança).

## Cenário 1 — Escritório recebe livro com o notebook desligado (US1, SC-001)

1. Desligue o PDV (ou o app Tauri).
2. No app do escritório, registre **entrada de 5 exemplares** do livro X (estoque atual 10).
3. Ligue o PDV com internet; dispare `sincronizar_agora` (ou aguarde o background).
4. **Esperado**: saldo do livro X no PDV = **15**; `custo_medio` recomputado; 1 `movimento_estoque` tipo `entrada`, `origem='escritorio'`.

## Cenário 2 — PDV vende offline e reconcilia (US2, SC-002)

1. Desconecte a internet do PDV.
2. Faça **3 vendas** do livro X. Confirme que concluem normalmente (venda nunca bloqueia).
3. Verifique `status_sincronizacao`: **3 pendentes**, `online=false`.
4. Reconecte; `sincronizar_agora`.
5. **Esperado**: as 3 vendas e suas saídas aparecem na nuvem, **uma vez cada** (`origem='pdv'`); o escritório vê o saldo reduzido.

## Cenário 3 — Convergência e idempotência (US3, SC-003/SC-004)

1. Com Cenário 1 (+5) e Cenário 2 (−3) aplicados sobre estoque inicial 10:
   - **Esperado**: saldo = **12** idêntico no PDV e na nuvem.
2. Rode `sincronizar_agora` **mais 2 vezes**.
   - **Esperado**: saldo permanece **12**; **zero** movimentos duplicados; `custo_medio` inalterado.

## Cenário 4 — Retomada após interrupção (US3, FR-010)

1. Gere ~50 movimentos offline no PDV.
2. Inicie o sync e **corte a rede no meio**.
3. Reconecte e rode `sincronizar_agora`.
4. **Esperado**: resultado final igual ao de um sync não interrompido; nada duplicado (upsert por `sync_uid`).

## Cenário 5 — Cadastro/preço LWW (US4, FR-008)

1. Edite o preço do livro X no escritório às 10h; edite no PDV às 11h (offline).
2. Sincronize os dois lados.
3. **Esperado**: ambos mostram o preço das **11h** (última edição); nenhum lado trava.

## Cenário 6 — Órfã histórica não derruba o sync (FR-012, D11)

1. Em base com órfã histórica (movimento com `livro_codigo` inexistente — ver memória `sqlite-fks-nao-enforced`), rode o seed/push inicial.
2. **Esperado**: os demais registros sincronizam; a órfã é **isolada e reportada** em `ResumoSync.orfas`; o lote **não** aborta.

## Cenário 7 — Segredos e acesso (SC-006/SC-008, D3)

1. Inspecione o bundle do PDV e do app web; tente acessar sem login.
2. **Esperado**: sem sessão autenticada não há leitura/gravação; nenhuma `service_role` recuperável (só token de usuário + RLS); cada gravação do escritório tem `criado_por`; segredos administrativos só no Notion.

## Cenário 8 — Dedup de livro/fornecedor (FR-017/FR-021, D4)

1. Cadastre o livro de código de barras `789...` no escritório e (offline) o mesmo código no PDV. Idem um fornecedor com o mesmo nome/documento.
2. Sincronize os dois lados.
3. **Esperado**: existe **um** livro e **um** fornecedor (dedup por chave natural); nenhum duplicado; cadastro resolve por última edição.

## Cenário 9 — Operador: cadastro no escritório + atribuição de venda (FR-022/FR-023, D15)

1. No escritório, cadastre um operador novo (usuário + nome, **sem senha**). Sincronize o PDV.
2. **Esperado**: o operador aparece no PDV como **pendente**; o login dele é bloqueado até definir a **senha localmente**. Nenhum `senha_hash` recuperável na nuvem/app web (SC-010).
3. Defina a senha no PDV, logue como esse operador e faça uma venda; sincronize.
4. **Esperado**: a venda na nuvem indica **"vendido por"** esse operador (SC-011); vendas antigas ficam como "operador desconhecido".

## Cenário 10 — Exclusão propaga sem ressuscitar (FR-015, D8)

1. Exclua um livro (ou fornecedor) num lado (ex.: no escritório). Sincronize os dois lados.
2. **Esperado**: o item some dos dois lados (soft delete via `excluido_em`).
3. Sincronize novamente (e edite o item no outro lado antes, se quiser testar o conflito exclusão×edição).
4. **Esperado**: o item **não reaparece**; a exclusão é idempotente e não é "desfeita" por uma sincronização posterior.

## Testes automatizados de referência

- `cargo test` — domínio de sync (ordenação pais→filhas, LWW, detecção de órfã, convergência do fold); adapter contra Postgres de teste (upsert idempotente, cursor, retomada).
- Vitest — app do escritório (recebimento grava evento cru; consulta lê views).
