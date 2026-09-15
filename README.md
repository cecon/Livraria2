# Livraria 2 — Espaço do Livro (PIB Penha)

Sistema desktop de **estoque & vendas** da livraria da igreja. Aplicativo gerencial de balcão,
**offline**, orientado a leitor de código de barras. Sem TEF nem nota fiscal — as formas de pagamento
apenas registram como a venda foi recebida.

## Agent Memory

Agentes de desenvolvimento podem usar um AgentMemory externo e opcional.
Configuracao, MCP e limites: [docs/agent-memory.md](docs/agent-memory.md).

## Stack

Marco da reorganizacao: `marco-pre-separacao-2026-09-14`.
Plano: [separacao PDV/nuvem](specs/013-separacao-pdv-nuvem/plan.md).

- `apps/pdv`: Tauri e layout React, com banco local.
- `apps/nuvem/web`: administrativo Next.js.
- `apps/nuvem/api`: API NestJS com Prisma/PostgreSQL, em introducao gradual.
- `packages/contratos`: comunicacao versionada entre sistemas.

Na raiz: `npm run dev` (PDV), `npm run dev:web` (administrativo),
`npm run dev:api` (API). Builds: `npm run build`, `npm run build:web`,
`npm run build:api`. API health: `/api/v1/health`.
O protocolo novo ainda nao substitui o acesso Supabase legado.

- **Tauri 2** (shell desktop) · **Rust** (núcleo de domínio)
- **React + TypeScript + Vite** · **shadcn/ui + Tailwind**
- **SQLite** via **SeaORM** (migrations idempotentes por comando)
- Importação do legado **Access** (`.mdb`) via `mdbtools`

## Arquitetura (Hexagonal / SOLID)

```
apps/pdv/src-tauri/src/
  domain/        # regras puras (Rust): Dinheiro (centavos), Livro, Pedido, ... — SEM UI/banco
  application/   # casos de uso + portas (traits): venda, cadastro, pesquisa, dashboard,
                 # relatorios, migracao
  adapters/      # implementações das portas: persistencia (SeaORM), legado (mdbtools), relogio
  migration/     # sea-orm-migration (idempotente)
  commands.rs    # porta de entrada Tauri (invoke)
apps/pdv/src/    # UI React (adapter de UI): routes/, components/, lib/
docs/adr/        # decisões de arquitetura
```

Princípios em [`.specify/memory/constitution.md`](.specify/memory/constitution.md): Hexagonal/SOLID,
KISS/DRY, **≤300 linhas significativas por arquivo de lógica**, migrations idempotentes, **dinheiro em
centavos**, hooks + skills + ADRs. Spec completa em
[`specs/001-sistema-estoque-vendas/`](specs/001-sistema-estoque-vendas/).

## Pré-requisitos

- Node 22+, Rust 1.93+
- `mdbtools` (só para importar o legado): `brew install mdbtools`

## Rodar

```bash
npm install
npm run tauri dev      # app desktop (cria e migra o SQLite na 1ª execução)
```

Build de produção: `npm run build && npm run tauri build`.

## Migração / Sincronização do legado

Na tela **Início**, informe o caminho do `.mdb` (padrão `../Livraria/livraria.mdb`) e clique
**Sincronizar**. Importa acervo + vendas de forma **idempotente** (upsert) — pode rodar quantas vezes
quiser durante a transição. Relatórios usam o gate padrão **adm / adm**.

## Testes & guardrails

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # domínio/aplicação (sem UI/banco) + integração
npm run build                                     # typecheck + build do front
scripts/check-file-size.sh                        # limite de 300 linhas
scripts/check-domain-purity.sh                    # domínio sem dependência de infraestrutura
```

Os guardrails rodam automaticamente no `git commit` (pre-commit) e nas edições do Claude Code.

## Memória do projeto (segredos & coisas de longa duração)

Senhas, credenciais, IDs de serviço e demais informações **sensíveis e de longa duração** ficam
centralizadas na página do Notion, **nunca** commitadas neste repositório:

📓 [Memoria_Projeto_Livraria (Notion)](https://app.notion.com/p/Memoria_Projeto_Livraria-3a30fcc132cf8068ab0dee09d80f9b76)

> Não cole segredos em código, README, `.env` versionado ou arquivos de spec. Registre-os no Notion
> e referencie por lá.
