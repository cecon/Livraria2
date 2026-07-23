# Research — Gestão de usuários com perfis (feature 010)

Resolve as decisões abertas do plano. Base: ADR-0019 (identidade unificada, hash bcrypt, RPC de auth,
sessão compartilhada do Escritório) já parcialmente implementado.

## D1 — Onde mora a regra de acesso por perfil

- **Decisão**: função pura no domínio `crates/livraria-domain/src/usuario.rs`:
  `Perfil { Operador, Admin }`, `pode_acessar_pdv(perfil) -> bool` (sempre true para ativo),
  `pode_acessar_escritorio(perfil) -> bool` (true só para `Admin`). Exposta ao WASM (`@livraria/domain`).
- **Rationale**: Princípio I (domínio isolado) + II (DRY — a MESMA regra vale no PDV nativo e no
  Escritório WASM; zero duplicação de "operador não entra no escritório"). Já é o padrão da feature 008
  (custo médio, baseline etc. via domínio compartilhado).
- **Alternativas rejeitadas**: regra hardcoded no `/api/login` do Escritório (duplica conhecimento, viola
  DRY); regra só no SQL/RPC (não reusável pelo PDV; mais difícil de testar unitariamente).

## D2 — Default de perfil e backfill dos existentes

- **Decisão**: coluna `perfil TEXT NOT NULL DEFAULT 'operador'`. No **backfill**, todos os usuários
  existentes migram como `operador`, **exceto o `adm`**, que é promovido a `admin` (idempotente:
  `UPDATE ... WHERE usuario='adm'`). Assim nunca se fica sem admin (o `adm` já existe).
- **Rationale**: seguro por padrão (menor privilégio); o único usuário hoje é o `adm` (que deve ser
  admin). Default `operador` evita criar admins sem intenção ao cadastrar.
- **Alternativas rejeitadas**: default `admin` (privilégio excessivo, risco); sem default (quebra
  inserts existentes / não idempotente).

## D3 — Gate do Escritório por perfil

- **Decisão**: a RPC `autenticar_usuario(usuario, senha)` passa a **retornar o `perfil`** (texto) quando
  a credencial confere e o usuário está ativo, ou **NULL** caso contrário. O `/api/login` do Escritório
  chama a RPC e aplica `pode_acessar_escritorio(perfil)` (regra do domínio via WASM); se false → 403 com
  mensagem genérica (FR-013). O PDV **não** usa essa RPC (autentica local/offline).
- **Rationale**: mantém o hash dentro do Postgres (SECURITY DEFINER), devolve só o mínimo (perfil), e a
  decisão de acesso fica na regra única do domínio. Retornar `perfil` (em vez de boolean) é aditivo.
- **Alternativas rejeitadas**: RPC `autenticar_escritorio` separada que embute a regra "admin" (duplica a
  regra no SQL); devolver a linha inteira do usuário (exporia mais que o necessário).

## D4 — Login do PDV (offline) e perfil

- **Decisão**: o login do PDV segue **local** (`usuario_repo::autenticar`, ADR-0019) — **ambos os perfis
  entram** (FR-003/FR-004: operador e admin acessam o PDV). O perfil é sincronizado para o PDV, mas **não
  bloqueia** entrada no PDV; serve para o encerramento de sessão (D6) e exibição.
- **Rationale**: o gate de perfil só restringe o **Escritório**; no PDV todo usuário ativo entra
  (FR-017). Offline-first exige auth local sem depender da nuvem.
- **Alternativas rejeitadas**: PDV consultar a nuvem para autorizar (quebra offline).

## D5 — Definição/redefinição de senha e criação de usuário (central)

- **Decisão**: RPCs `SECURITY DEFINER` na nuvem: `definir_senha_usuario(usuario, senha)` (hash bcrypt via
  `pgcrypto`), `criar_usuario(usuario, nome, senha, perfil)` e `editar_usuario(usuario, nome, perfil)` /
  `desativar_usuario(usuario)`. Todas exigem que o **chamador seja admin** (a sessão compartilhada do
  Escritório representa um admin já autenticado no `/api/login`; as RPCs recebem o `usuario` admin da
  sessão e validam o perfil dele). Senha nunca trafega como hash para o cliente (FR-012).
- **Rationale**: consolida a escrita sensível (senha/perfil) no Postgres, protegida; o Escritório só
  envia texto puro sob HTTPS. bcrypt no `pgcrypto` casa com a verificação Rust (ADR-0019).
- **Alternativas rejeitadas**: Escritório hashear em JS e gravar via PostgREST (dois algoritmos para
  manter em sincronia; risco); gravar `senha_hash` direto via `upsert` do cliente (exporia a coluna).

## D6 — Propagação ao PDV + proteção da coluna (conclui Stage 3 do ADR-0019)

- **Decisão**: `senha_hash` **e** `perfil` passam a sincronizar para o PDV. Como PDV e Escritório usam o
  mesmo papel `authenticated`, protege-se por **caminho dedicado**: `REVOKE SELECT (senha_hash) ON
  usuario` e o PDV **puxa `usuario` por uma RPC `sync_pull_usuarios(cursor)` `SECURITY DEFINER`** que
  devolve as linhas com `senha_hash`+`perfil`. O `select=*` do pull genérico deixa de tocar `usuario`.
- **Rationale**: fecha o ADR-0019 (proteção do hash) sem quebrar o pull (que hoje faz `select *`). O
  perfil desce junto para habilitar D4/D6 e o encerramento de sessão.
- **Alternativas rejeitadas**: revogar a coluna sem trocar o pull (quebra o sync do PDV — `select *`
  daria permission denied); não proteger (hash legível pelo cliente do Escritório).

## D7 — Encerramento de sessão do PDV ao sincronizar (FR-018)

- **Decisão**: o PDV mantém o **operador logado** referenciado por `usuario`. Após cada sincronização, se
  o usuário logado ficou **desativado** (`excluido_em` preenchido) **ou** perdeu acesso (não muda para o
  PDV, pois ambos os perfis entram — então o gatilho aqui é só **desativação**), o PDV **encerra a sessão
  ativa** (logout forçado) e volta à seleção de operador. Rebaixe admin→operador **não** encerra sessão
  no PDV (operador continua com acesso ao PDV); só afeta o Escritório no próximo login.
- **Rationale**: coerente com FR-017 (perfil não muda acesso ao PDV). O único caso que corta acesso ao
  PDV é **desativar**. Assim o "logout forçado ao sincronizar" (resposta B do clarify) se aplica à
  desativação; o rebaixe afeta só o Escritório (onde a sessão é online e cai no próximo acesso).
- **Nota**: refinar no data-model — o gatilho concreto é `excluido_em IS NOT NULL` para o `usuario`
  logado detectado pós-sync.
- **Alternativas rejeitadas**: encerrar sessão em qualquer mudança de perfil (contraria FR-017, já que
  operador rebaixado ainda pode usar o PDV).

## D8 — Unicidade e último admin

- **Decisão**: unicidade por `usuario` (índice único já existe — chave natural do sync). Guarda do
  **último admin**: verificação na RPC `editar_usuario`/`desativar_usuario` (`count(admins ativos) > 1`
  antes de rebaixar/desativar um admin) **e** reforço na UI. Regra de contagem também disponível como
  função pura de domínio para teste.
- **Rationale**: invariante crítico (FR-014) — precisa valer no ponto de escrita (RPC), não só na UI.
- **Alternativas rejeitadas**: validar só na UI (burlável); trigger no banco (mais opaco/《magia》 que a
  RPC explícita).

## D9 — Numeração de migrations

- **Decisão**: local `m010` (o `m009` está **reservado** para turno — feature 009, handoff da 008);
  nuvem `0006`/`0007`. Coordenar com a 009 para não colidir (mesma lição do ADR-0019).
- **Rationale**: evita colisão de número já vivida no repo.
