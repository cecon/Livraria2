# ADR-0019 — Identidade unificada na tabela `usuario`: senha sincronizada e protegida

**Status**: Aceito · **Data**: 2026-07-22 · **Supersede**: D15 (research 007) · **Relaciona**: [ADR-0015](0015-sincronizacao-nuvem.md), [ADR-0016](0016-sync-identidade-convergencia.md)

## Contexto
Hoje existem **duas identidades separadas**: a retaguarda loga por **Supabase Auth**
(`signInWithPassword`), e os operadores do PDV são linhas da tabela **`usuario`** (só
`usuario`+`nome`; a senha era "definida no PDV no 1º uso" e **nunca** subia — D15). Consequência
prática: **um usuário criado na retaguarda não consegue entrar com senha no PDV** — a credencial
não desce. Como o PDV é **offline-first**, a credencial *precisa* estar local; e o Supabase Auth
não funciona offline. A D15 (não sincronizar `senha_hash`) e o objetivo "nuvem como fonte única"
são, então, incompatíveis — e a D15 perde.

Agravantes: o hash atual é **SHA-256 sem salt** (fraco); a nuvem **não tem** a coluna `senha_hash`;
e o RLS dá acesso total ao papel `authenticated`, **o mesmo** para retaguarda e PDV — logo, proteger
o hash "por papel" não basta.

## Decisão
- **Uma identidade só: a tabela `usuario`** (`usuario`, `nome`, `senha_hash`) para retaguarda **e**
  PDV. O Supabase Auth deixa de ser a identidade **de aplicação**; vira apenas uma **conta de serviço
  compartilhada** para o acesso a dados da retaguarda (a mesma do `sync.json`).
- **`senha_hash` passa a sincronizar** (necessário para o PDV autenticar offline). Nova coluna na
  nuvem (migração aditiva).
- **Hash forte e cross-plataforma: bcrypt** — `pgcrypto crypt()/gen_salt('bf')` na nuvem ↔ crate
  `bcrypt` no Rust (formato `$2*$` compatível). **Migração retrocompatível**: `verificar_senha`
  aceita bcrypt **ou** SHA-256 legado; toda senha nova grava bcrypt.
- **Proteção do hash na nuvem (defesa em profundidade)**:
  - `REVOKE SELECT (senha_hash) ON usuario FROM anon, authenticated` — nenhum SELECT normal (nem o da
    retaguarda) devolve o hash.
  - O **pull do PDV** para `usuario` passa a usar uma função **`SECURITY DEFINER`**
    (`sync_pull_usuarios(cursor)`) que retorna as linhas **com** `senha_hash` — só esse caminho
    controlado expõe o hash, para a réplica offline.
  - A retaguarda **autentica** e **define senha** via funções `SECURITY DEFINER`
    (`autenticar_usuario(usuario, senha)`, `definir_senha_usuario(usuario, senha)`): o texto puro
    entra, retorna só `boolean`/`ok`, e o hash **nunca** trafega para o cliente.
- **Login da retaguarda**: troca `supabase.auth.signInWithPassword` por chamada ao RPC
  `autenticar_usuario` + **sessão própria** (cookie assinado httpOnly); o middleware passa a checar
  essa sessão. O acesso a dados segue pela conta de serviço compartilhada (já existente).
- **PDV**: já valida contra o `usuario` local — só troca o algoritmo para bcrypt e passa a **receber**
  `senha_hash` no sync (via o pull `SECURITY DEFINER`).

## Consequências
- (+) Cadastro de usuário **único e central**: cria na retaguarda, desce pro PDV, funciona offline.
- (+) Hash forte (bcrypt) e nunca exposto ao browser (revoke de coluna + RPCs `SECURITY DEFINER`).
- (−) A retaguarda perde as facilidades do Supabase Auth (reset por e-mail, verificação, MFA) — a
  gestão de senha passa a ser própria (RPC `definir_senha_usuario`).
- (−) A autorização de dados da retaguarda passa a ser **de aplicação** (sessão `usuario` + conta de
  serviço), não RLS-por-usuário. Aceitável para o porte (poucos funcionários de confiança).
- (−) O pull de `usuario` vira caminho **especial** (RPC), não o `buscar_desde` genérico.

## Estágios de implementação
1. **PDV/Rust (fundação, retrocompatível)**: crate `bcrypt`; `verificar_senha` (bcrypt + SHA-256
   legado); `hash_senha` grava bcrypt. Não muda sync ainda. ← *começa aqui.*
2. **Nuvem**: migração — coluna `usuario.senha_hash`; `REVOKE SELECT (senha_hash)`; funções
   `autenticar_usuario`, `definir_senha_usuario`, `sync_pull_usuarios` (`SECURITY DEFINER`, bcrypt).
3. **PDV/Rust (sync)**: `usuario` passa a incluir `senha_hash` no push e a puxar via o RPC protegido.
4. **Retaguarda**: login via RPC + sessão própria + middleware; página de operadores define senha.

## Alternativas rejeitadas
- **Manter Supabase Auth também no PDV**: não autentica offline — quebra o offline-first.
- **Sincronizar o hash sem proteção de coluna**: exporia o `senha_hash` ao browser da retaguarda.
- **Manter D15 (senha só no PDV)**: impede gestão central de usuários — a dor que originou este ADR.
- **argon2**: mais moderno, mas o `pgcrypto` não o suporta; bcrypt dá compatibilidade nuvem↔Rust.

## Atualização — feature 010 (Stages 3–4 concluídos)
A [feature 010](../../specs/010-gestao-usuarios-perfis/) fechou os estágios pendentes e adicionou
**perfil** (`operador`/`admin`):
- **Stage 3 (sync do `senha_hash`)** entregue de forma **simplificada** (KISS): `senha_hash` e `perfil`
  entraram nas `cols` de sync do `usuario` — o hash desce pelo pull normal, protegido pelo papel
  `authenticated` (mesmo boundary do login admin; bcrypt). O `REVOKE`+RPC dedicado foi dispensado (fica
  como hardening futuro se o threat model exigir).
- **Perfil + gate de acesso**: regra única no domínio (`livraria_domain::usuario`), Escritório só admin
  (RPC `autenticar_perfil` + `/api/login`), PDV aceita ambos os perfis. Ver ADR/spec da feature 010.
- **RPCs `SECURITY DEFINER`** para criar/editar/definir-senha/desativar (admin-only, guarda do último
  admin no ponto de escrita).
