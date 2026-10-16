# Implementation Plan: Ajustar estoque a partir do cadastro do livro

**Branch**: `014-ajuste-estoque-cadastro` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-ajuste-estoque-cadastro/spec.md`

## Summary

A tela **"Alterar livro"** do Cadastro do escritório passa a mostrar o **estoque atual** (saldo
oficial da nuvem) e o botão **"Ajustar estoque"**, reutilizando o componente de ajuste que já existe
na Pesquisa. A única regra nova é **recusar ajuste que deixe o saldo negativo** (FR-012). Ela nasce
**pura no domínio Rust** (`estoque::validar_ajuste`), chega ao escritório pelo WASM (ADR-0022) para
dar retorno imediato, e é **garantida na nuvem** por uma guarda transacional no insert do movimento
de ajuste (a nuvem é a autoridade do estoque, ADR-0023), restrita ao **ajuste manual**
(`referencia = 'ajuste_manual'`), o que cobre ajustes concorrentes e também a Pesquisa sem afetar o
estorno de nota cancelada nem o inventário. Não há mudança de esquema: o ajuste continua sendo um `movimento_estoque` do tipo
`ajuste`.

## Technical Context

**Language/Version**: Rust 1.93 (crate `livraria-domain` + `livraria-domain-wasm`); TypeScript 5.7 /
React 19 / Next.js 15 (app `apps/escritorio`); SQL Postgres (Supabase, `apps/nuvem/migrations`)

**Primary Dependencies**: `@livraria/domain` (WASM, wasm-bindgen), `@livraria/ui` (shadcn/ui),
`@supabase/supabase-js`, `sonner` (toasts)

**Storage**: Postgres na nuvem (Supabase) — `movimento_estoque`, `livro`, view `vw_saldo_livro`.
Sem mudança no SQLite do PDV.

**Testing**: `cargo test -p livraria-domain` (regra pura); `vitest` na raiz (camada
`apps/escritorio/lib/nuvem/__tests__`); script SQL em `apps/nuvem/tests/` para a guarda no banco
(aplicado em homologação, padrão das features 011–013)

**Target Platform**: Escritório web (navegador desktop e celular); nuvem Supabase

**Project Type**: monorepo — domínio Rust compartilhado + app web do escritório + migrações da nuvem

**Performance Goals**: ajuste confirmado e saldo atualizado na tela em < 2 s numa conexão normal
(uma escrita + uma leitura do saldo)

**Constraints**: online-only (retaguarda na nuvem, constituição v2.1.0); dinheiro não envolvido;
≤ 300 linhas significativas por arquivo; migração idempotente

**Scale/Scope**: 1 tela alterada (Alterar livro), 1 componente reutilizado (AjusteEstoque), 1 função
de domínio, 1 migração (guarda), ~2 mil livros, ajustes esporádicos (dezenas por mês)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — Hexagonal/SOLID**: ✅ A regra "ajuste não pode deixar saldo negativo, quantidade ≠ 0, motivo
  obrigatório" nasce no **domínio** (`estoque::validar_ajuste`, testável sem UI e sem banco) e é
  exposta ao escritório pelo adapter WASM. A escrita na nuvem continua atrás de
  `lib/nuvem/movimentos.ts` (adapter). A UI só chama.
- **II — KISS/DRY/YAGNI**: ✅ Reutiliza o `AjusteEstoque` da Pesquisa (um componente, uma regra para as
  duas telas); nenhuma tabela, coluna ou RPC nova. ⚠️ A checagem de saldo existe no domínio **e** na
  guarda do banco — ver Complexity Tracking (a do banco é a garantia transacional, não uma segunda
  regra de negócio; ambas usam o mesmo código de erro `ESTOQUE_NEGATIVO`).
- **III — ≤300 linhas**: ✅ `app/cadastro/page.tsx` já tem 249 linhas: o `LivroForm` é **extraído**
  para `components/LivroForm.tsx` antes de crescer. `AjusteEstoque.tsx` (~60) e `estoque.rs` seguem
  folgados.
- **IV — Idempotência por comando**: ✅ Migração `0016_ajuste_sem_saldo_negativo.sql` com
  `create or replace function` + `drop trigger if exists` — reaplicar não muda nada. Sem migração no
  SQLite.
- **V — Guardrails/ADR**: ✅ Registrar **ADR-0026** (ajuste de estoque nunca deixa saldo negativo:
  regra no domínio + guarda na nuvem, só para ajustes de origem escritório). Hook de 300 linhas cobre
  os arquivos novos.
- **VI — pt-BR/domínio**: ✅ Termos preservados ("Ajustar estoque", "Estoque atual", "Motivo");
  mensagem pt-BR com o saldo atual. Sem dinheiro envolvido.

**Invariante offline (v2.1.0)**: ✅ Não afetado — ajuste é retaguarda na nuvem; o PDV não ganha
ajuste e continua vendendo offline. A guarda vale só para ajustes manuais do escritório
(`referencia = 'ajuste_manual'`), então não interfere em movimentos que chegam por sync, no estorno
de nota nem no inventário.

**Resultado**: passa, com uma justificativa registrada (guarda duplicada no banco).

## Project Structure

### Documentation (this feature)

```text
specs/014-ajuste-estoque-cadastro/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ajuste-estoque.md   # domínio/WASM, guarda SQL, adapter TS e props da UI
├── checklists/requirements.md
└── tasks.md                      # (/speckit-tasks)
```

### Source Code (repository root)

```text
crates/livraria-domain/src/
├── estoque.rs            # + validar_ajuste(saldo, delta, motivo) -> Result<i64, ErroDominio>
└── erros.rs              # + AjusteSemQuantidade ("AJUSTE_SEM_QUANTIDADE")
crates/livraria-domain-wasm/src/lib.rs   # + validar_ajuste_estoque (export WASM)
packages/domain/                          # artefato WASM regenerado SÓ pelo CI (wasm.yml) após push

apps/nuvem/
├── migrations/0016_ajuste_sem_saldo_negativo.sql   # guarda BEFORE INSERT (ajuste manual do escritório)
├── migrations/README.md                            # + linha da 0016
└── tests/0016_ajuste_sem_saldo_negativo.sql        # casos: aceita, zera, recusa, concorrência

apps/escritorio/
├── app/cadastro/page.tsx            # usa o LivroForm extraído
├── components/LivroForm.tsx         # NOVO (extraído) + Estoque atual + AjusteEstoque
├── components/AjusteEstoque.tsx     # + saldoAtual, validação via domínio, trava de envio, erro mantém aberto
├── app/pesquisa/page.tsx            # passa saldoAtual ao AjusteEstoque
└── lib/nuvem/
    ├── estoque.ts                   # + saldoLivro(livroUid)
    ├── movimentos.ts                # registrarAjuste grava referencia 'ajuste_manual' e mapeia ESTOQUE_NEGATIVO
    └── __tests__/movimentos.test.ts # mapeamento de erro + payload do ajuste

docs/adr/0026-ajuste-sem-saldo-negativo.md
```

**Structure Decision**: segue o monorepo atual — regra no `crates/livraria-domain`, ponte em
`crates/livraria-domain-wasm`, adapters e telas em `apps/escritorio`, garantia em
`apps/nuvem/migrations`. Nenhum projeto ou pacote novo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Checagem de saldo negativo no domínio **e** numa guarda SQL (DRY parcial) | O domínio dá retorno imediato e é a regra testável; só a nuvem vê o saldo oficial no momento do insert e trava a linha do livro contra **outro ajuste** concorrente (a baixa de venda não usa a trava — risco residual aceito, ver research D2) | Só no domínio/cliente: corrida entre ajustes e saldo lido na abertura da tela podem gravar saldo negativo. Só no SQL: viola o Princípio I (regra fora do domínio, não testável sem banco) e o retorno ao usuário só viria após ida à nuvem |
