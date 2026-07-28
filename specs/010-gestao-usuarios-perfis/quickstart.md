# Quickstart — Validação da gestão de usuários (feature 010)

Guia de validação ponta-a-ponta. Prova que a feature atende US1–US3 e os edge cases. Não contém código
de implementação — só passos e resultados esperados.

## Pré-requisitos

- Migrações aplicadas: local `m010` (PDV) e nuvem `0006`/`0007`. Backfill feito (`adm` = admin).
- WASM `@livraria/domain` regenerado (expondo `Perfil`/regras de acesso).
- Escritório rodando com a sessão compartilhada (ADR-0019): `.env.local` com `ESCRITORIO_EMAIL/SENHA`.
- Existe ao menos o `adm` (admin) com senha conhecida.

## Testes de domínio (rápidos, sem UI)

```bash
cargo test -p livraria-domain usuario      # regras de acesso: operador/admin/ativo/último-admin
cargo test --lib usuario                    # verificar_senha (bcrypt/legado) — ADR-0019
```
**Esperado**: verde. `pode_acessar_escritorio(Operador,*)=false`, `(Admin,ativo)=true`;
`pode_acessar_pdv(*,ativo)=true`.

## US1 — Admin cadastra usuário com perfil e senha

1. No Escritório, logar como `adm`. Abrir **Usuários → Novo usuário**.
2. Criar `caixa1` / nome / senha `1234` / perfil **operador**. Salvar.
   - **Esperado**: aparece na lista como *operador / ativo*.
3. Sincronizar o PDV. Logar no PDV como `caixa1` / `1234`.
   - **Esperado**: entra no PDV (offline inclusive, após a 1ª sync). ✅ SC-003
4. Criar `gerente` perfil **admin**. Logar com ele no PDV **e** no Escritório.
   - **Esperado**: entra nos dois. ✅ FR-004

## US2 — Acesso por perfil

1. Tentar logar no **Escritório** com `caixa1` (operador).
   - **Esperado**: **negado** com mensagem genérica; permanece fora. ✅ SC-002 / FR-003
2. Logar no **PDV** com `caixa1`.
   - **Esperado**: entra. ✅ FR-003
3. Desativar `caixa1` no Escritório; sincronizar PDV.
   - **Esperado**: `caixa1` não loga em lugar nenhum; se estava logado no PDV, ao sincronizar o PDV
     **encerra a sessão** (logout forçado). ✅ FR-008/FR-018

## US3 — Gestão (editar, redefinir senha, desativar, último admin)

1. Redefinir a senha de `gerente`. Login antigo falha, novo funciona (após sync no PDV). ✅ FR-007
2. Promover `caixa1` (se reativado) a admin → passa a entrar no Escritório. ✅ FR-006
3. Deixar **só um admin ativo** e tentar rebaixá-lo/desativá-lo.
   - **Esperado**: **bloqueado** com aviso "precisa existir ao menos um admin". ✅ FR-014 / INV-2
4. Conferir que vendas atribuídas a um usuário desativado **permanecem** no histórico. ✅ FR-016

## Segurança (conferências)

- Inspecionar respostas de rede da tela de usuários: **nenhuma** traz `senha_hash`. ✅ FR-012 / INV-3
- Tentar `select senha_hash from usuario` com a chave anon/publishable → **negado** (coluna revogada).
- Mensagens de erro de login **não** revelam se o usuário existe ou qual campo falhou. ✅ FR-013

## Critérios de aceite (resumo)

| Success Criteria | Onde é provado |
|---|---|
| SC-001 (cadastro < 1 min) | US1 passo 2 |
| SC-002 (100% operador barrado no escritório) | US2 passo 1 |
| SC-003 (novo usuário loga no PDV offline pós-sync) | US1 passo 3 |
| SC-004 (zero senha em texto claro) | Segurança |
| SC-005 (nunca sem admin) | US3 passo 3 |
| SC-006 (desativado barrado + histórico intacto) | US2 passo 3 / US3 passo 4 |
