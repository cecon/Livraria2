# Contrato — Paridade de telas (PDV → Escritório)

As telas novas do Escritório replicam o **fluxo e layout** do PDV (não só o tema — lição da 008), consumindo
`@livraria/ui` e `@livraria/domain`. Cada tela decomposta em componentes ≤300 linhas (Princípio III).

## Venda — `apps/escritorio/app/venda/page.tsx`

Referência PDV: `src/routes/Venda.tsx` (abas "Venda" | "Lista de vendas"), `src/components/Pdv.tsx`.

| Componente PDV | Equivalente Escritório | Papel |
|---|---|---|
| `EntradaProduto` | reusa o já existente em `apps/escritorio/components/EntradaProduto.tsx` | busca por código/título/autor |
| `CarrinhoItens` | `components/Carrinho.tsx` (novo) | itens, qtd, total |
| `PaymentRow` | `components/FormasPagamento.tsx` (novo) | recebimento por forma; troco (WASM) |
| `VendaConcluida` | `components/VendaConcluida.tsx` (novo) | confirmação animada (`venda-pop`) |
| aba "Lista de vendas" (`ListaVendas`) | seção/aba na mesma página | vendas do dia |

**Gate visual**: se **não houver turno aberto**, a tela bloqueia o checkout e mostra CTA "Abrir turno" (FR-002).

## Inventário — `apps/escritorio/app/inventario/page.tsx`

Referência PDV: `src/routes/Inventario.tsx` + `src/components/InventarioScanner.tsx`.

| Componente PDV | Equivalente Escritório | Papel |
|---|---|---|
| seletor de modo (parcial/total) + abrir/fechar/cancelar | `components/ContagemInventario.tsx` (novo) | ciclo da sessão (client-side) |
| `InventarioScanner` (+1 / desfazer −1) | reusa `EntradaProduto` + card de contagem | bipar por código/câmera |
| tabela de divergências / revisão | `components/RevisaoContagem.tsx` (novo) | reconciliação antes de aplicar ajustes |

## Turno — `apps/escritorio/app/turnos/page.tsx`

**Sem tela equivalente no PDV** (o turno de operação é conceito novo — ADR-0021). Layout no idioma do design:

| Estado | Conteúdo |
|---|---|
| Sem turno aberto | botão "Abrir turno" + campo opcional "Caixa inicial" (`parse_brl`) |
| Turno aberto | resumo ao vivo (nº de vendas, totais por forma) + botão "Encerrar turno" |
| Encerrar | `components/FechamentoCaixa.tsx` (novo): totais por forma (informativos) + **conferência do dinheiro** (esperado vs. campo "conferido") + diferença; confirma e fecha |
| Histórico | lista de turnos encerrados com seus fechamentos |

## Navegação — `packages/ui/src/nav.tsx`

Adicionar os itens que faltam ao `NAV_ITENS` **compartilhado** (aparecem no PDV e no Escritório por construção):
**Venda**, **Inventário** e **Turno** — reusando os ícones/rotas do PDV (`/venda`, `/inventario`, `/turnos`).
Como o PDV ainda não tem `/turnos`, adicionar a rota no `src/App.tsx` também (fluxo de turno no PDV).
