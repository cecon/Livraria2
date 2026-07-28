# ADR-0020 — UI compartilhada via `packages/ui` + workspace

**Status**: Aceito · **Data**: 2026-07-22

## Contexto
A feature 008 exige que o Escritório fique **visualmente idêntico** ao PDV (mesmo tema, CSS, componentes,
barra lateral) e **continue idêntico ao longo do tempo** (FR-015, "sem retrabalho duplicado que diverge").
Hoje os dois apps não compartilham **nada** visual:
- **PDV** (`src/`): Tailwind v4 (config em CSS via `@theme`), shadcn/ui (radix-nova), tokens oklch, verde
  de marca `#1f7a4d`, fonte Geist, dark mode por classe, 9 componentes em `src/components/ui/`.
- **Escritório** (`apps/escritorio/`): um `globals.css` de ~65 linhas, sem Tailwind/shadcn, sem dark mode,
  taxonomia de menu diferente. Alias `@/*` aponta para a raiz do app.

O repositório **não é um monorepo** (sem `workspaces` na raiz). Copiar tokens/componentes para o
Escritório garantiria **drift** a cada ajuste do PDV — contrário ao objetivo de paridade (SC-004).

## Decisão (specs/008-escritorio-espelho-pdv/research.md D5, D6)
- **Tornar o repo um workspace** (npm workspaces para JS; Cargo workspace para o crate de domínio —
  ADR-0022). Raiz: `workspaces: ["packages/*","apps/*"]`; Next usa `transpilePackages`.
- **Extrair `packages/ui` (`@livraria/ui`)** como fonte visual única: os tokens `@theme`/`:root`/`.dark`
  (de `src/index.css`), os componentes `components/ui/*` (shadcn) e `lib/utils` (`cn`). **PDV e Escritório
  consomem o mesmo pacote.**
- **PDV migra** os imports locais de `components/ui` e tokens para `@livraria/ui` (segue buildando com o
  plugin `@tailwindcss/vite`, `@source` apontando para o pacote).
- **Escritório adota** Tailwind v4 (`@tailwindcss/postcss`), `next-themes` (dark por classe, chave
  `eldl-theme`), `lucide-react` e replica a **mesma barra lateral** (10 itens, mesmos rótulos/ícones/ordem)
  e rotas. Componentes interativos marcados `"use client"` no App Router.
- **Identidade visual do PDV é a referência** (Constituição VI, protótipo de alta fidelidade); o
  Escritório é que se ajusta.

## Consequências
- **Positivas**: paridade visual com **uma fonte de verdade** (anti-drift por construção, FR-015);
  manutenção única dos componentes; alinhado a KISS/DRY.
- **Custos/risco**: introduzir tooling de workspace (npm workspaces + Cargo workspace) num repo que hoje
  é single-project — mudança de build sensível (instalação/hoist do npm; `[workspace]` do Cargo);
  Tailwind v4 tem integração por app (plugin Vite vs `@tailwindcss/postcss`); `"use client"` obrigatório
  para componentes interativos no Next; padronizar o alias `@/*`. Requer validar `npm install`/`cargo
  build`/`next build` após a conversão.
- **Alternativas rejeitadas**: copiar tokens+componentes para o Escritório (drift garantido); manter dois
  estilos independentes (contraria o objetivo de "não gerar estranhamento").
