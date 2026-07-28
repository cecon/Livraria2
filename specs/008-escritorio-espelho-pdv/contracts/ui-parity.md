# Contrato — Paridade de UI (PDV → Escritório)

Fonte visual única em `@livraria/ui` (extraído de `src/`). O Escritório deve renderizar telas **visualmente indistinguíveis** das do PDV.

## Barra lateral (mesma ordem, rótulo, ícone lucide, rota)

| # | Rótulo | Rota | Ícone | Estado atual no Escritório |
|---|---|---|---|---|
| 1 | Início | `/` | `Home` | existe (home diferente) → realinhar |
| 2 | Venda | `/venda` | `ShoppingCart` | **novo** (US3) |
| 3 | Cadastro | `/cadastro` | `BookPlus` | existe como `/livros` → renomear/alinhar |
| 4 | Pesquisa | `/pesquisa` | `Search` | existe como `/consulta` → renomear/alinhar |
| 5 | Lançamentos | `/lancamentos` | `PackagePlus` | existe como `/recebimento` → alinhar |
| 6 | Fornecedores | `/fornecedores` | `Truck` | existe → realinhar |
| 7 | Formas de Pagamento | `/formas-pagamento` | `Wallet` | **novo** |
| 8 | Destinações | `/destinacoes` | `HeartHandshake` | **novo** |
| 9 | Inventário | `/inventario` | `ClipboardList` | **novo** (US3) |
| 10 | Relatórios | `/relatorios` | `FileBarChart` | existe → realinhar |

- Marca: "EL" em `bg-[#1f7a4d]`, título "Espaço do Livro". Toggle de tema (Sun/Moon).
- Rota ativa: match exato para `/`, prefixo para as demais (como no PDV).
- Nota: `operadores` do Escritório não é item de sidebar no PDV — manter acessível, mas fora do menu espelhado (ou alinhar à decisão de paridade).

## Tema (tokens `@theme` / Tailwind v4 — portar de `src/index.css`)

- Fonte: `--font-sans: 'Geist Variable'`.
- Marca (verde): `--color-brand:#1f7a4d` (escala 50–700).
- Núcleo (oklch): `--background`, `--foreground`, `--primary`, `--destructive`, `--radius: 0.625rem`, conjunto `--sidebar-*`, `--chart-1..5`.
- Dark mode: classe `.dark` no `<html>` (via `next-themes`, espelhar chave `eldl-theme`), `@custom-variant dark`.

## Componentes (mesmos shadcn de `packages/ui`)

`badge`, `button`, `card`, `input`, `label`, `select`, `sonner` (toasts), `table`, `textarea`. Interativos marcados `"use client"` no App Router. Estados **carregando / vazio / erro** com a mesma aparência do PDV.

## Turno de operação (US4) — UI

- **Indicador de turno** no cabeçalho/barra: mostra turno aberto (operador + nº/hora) ou "Nenhum turno aberto".
- **Abrir turno**: ação explícita (botão/modal) com campo opcional de **caixa inicial**.
- **Venda** bloqueada sem turno aberto → CTA "Abrir turno".
- **Encerrar turno**: tela/modal de **fechamento de caixa** — totais por forma de pagamento, qtd de vendas, **esperado vs. conferido** (campo de conferência) e diferença.
- Mesma aparência/fluxo no PDV e no Escritório (componentes de `@livraria/ui`).

## Aceite visual

- 100% dos itens de navegação coincidem (SC-001).
- Zero telas com identidade divergente (SC-004): comparar lado a lado cada rota equivalente.
