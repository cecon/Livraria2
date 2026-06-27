# Quickstart — Validação ponta a ponta (004)

Pré-requisitos: toolchain do projeto (Rust 1.93, Node/npm), banco SQLite de desenvolvimento. Rodar do repo root.

## 0. Migração de identidade (US1 — o crítico)

**Antes**: tenha um banco com dados reais ou de teste (livros + movimentos + ao menos uma sessão de inventário fechada + um lançamento de entrada).

1. Anote as contagens atuais:
   - `SELECT count(*) FROM livro, ...` para `livro`, `movimento_estoque`, `item_contagem`, `item_lancamento`.
2. Suba o app (aplica `m004` no boot): `npm run tauri dev` (ou o script de migração por comando).
3. **Esperado**:
   - `PRAGMA table_info(livro)` mostra `id` (pk), `codigo` (notnull, único), **sem** `codigo_barras`.
   - `livro` com a mesma contagem; as filhas com a contagem das **linhas válidas** (total menos as órfãs pré-existentes — na base atual, `movimento_estoque` e `item_contagem` perdem 1 linha cada, do livro `cmmb57324`, e isso aparece **no log** da migração).
   - `PRAGMA foreign_key_check;` retorna **vazio** (as órfãs que apareciam antes somem).
   - `item_pedido` inalterado (ainda por `codigo`).
   - Conferir o **log** da migração: nenhuma linha **válida** perdida; só órfãs removidas.
4. Reinício: subir de novo **não** re-executa `m004` (já em `seaql_migrations`).
5. Teste automatizado: `cargo test` inclui um teste de `m004` sobre base populada (conta antes/depois + `foreign_key_check`).

Critério: **zero perda de dados** (SC-001) e `codigo_barras` ausente (SC-002).

## 1. Bipagem segue pelo `codigo`

1. Abrir uma sessão de inventário, bipar um livro pelo seu `codigo` (barcode). **Esperado**: contagem incrementa (busca casa `codigo`, sem `codigo_barras`).

## 2. Pendências — "Já resolvido" / "Cadastrar livro" / reabrir (US2/US4/US5)

1. Bipar um código inexistente → vira pendência.
2. Na lista, há **dois botões**: "Cadastrar livro" e "Já resolvido".
3. Clicar **"Já resolvido"** → pendência sai da lista ativa; estoque inalterado (SC-003).
4. Consultar **resolvidas** → a pendência aparece com código/qtd; **Reabrir** → volta à lista ativa (SC-004).
5. Em outra pendência, **"Cadastrar livro"** → cadastro abre com o `codigo` preenchido; ao salvar, a pendência some da lista ativa.

## 3. Visualizar inventários realizados (US3)

1. Fechar uma sessão com divergências conhecidas (ex.: 6 batem, 3 faltam, 1 sobra).
2. Entrar na área de Inventário (sem sessão aberta) → ver a **lista de realizados**.
3. Abrir a sessão → **agregados**: total=10, bateram=6, faltaram=3, sobraram=1, soma das diferenças; **detalhe** por livro (sistema × contado × diferença); **pendências** da sessão.
4. Confirmar: **nenhum** controle de edição/reabrir/reaplicar (SC-005, SC-006).

## 4. Remover "Importar base de dados" (US6)

1. Abrir a tela Início. **Esperado**: **sem** card de Migração/Sincronização do legado; nenhum caminho na UI para importar (SC-007).
2. Vendas, estoque e inventário seguem funcionando; dados intactos.

## Referências
- Esquema e passos da migração: [data-model.md](data-model.md)
- Comandos: [contracts/tauri-commands.md](contracts/tauri-commands.md)
- Decisões: [research.md](research.md) → ADR-0012
