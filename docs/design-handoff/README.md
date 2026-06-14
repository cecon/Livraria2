# Handoff — Espaço do Livro (PIB Penha): modernização do sistema de estoque & vendas

## Visão geral
Modernização do sistema gerencial de uma livraria de igreja (**Espaço do Livro — PIB Penha**).
Cobre **8 telas**: Início (dashboard), Venda (PDV), Cadastro de livro, Pesquisa, Detalhes,
Login de Relatórios e Relatório emitido (Vendas / Estoque / Zerado).

O sistema é **gerencial**: **não há TEF nem emissão de nota fiscal**. As formas de pagamento
servem apenas para registrar como a venda foi recebida.

> **Objetivo do redesign:** modernizar a aparência mantendo o **mesmo modelo mental** dos
> usuários atuais (sem causar estranheza). Layouts e termos foram preservados; só a camada
> visual e a ergonomia foram refeitas.

---

## Sobre os arquivos deste pacote
Os arquivos em `app/` + `Espaço do Livro.html` são uma **referência de design feita em HTML/React via Babel no navegador** — um protótipo que demonstra aparência e comportamento pretendidos. **Não é código de produção para copiar e colar.**

A tarefa é **recriar este design na stack-alvo** já definida pelo time:

- **Tauri 2** (shell desktop)
- **React** + **TypeScript**
- **shadcn/ui** + **Tailwind CSS**
- **SQLite** (via plugin `tauri-plugin-sql` ou camada Rust + comandos `invoke`)

O protótipo já foi escrito **propositalmente próximo do shadcn/Tailwind**, então o mapeamento é
quase 1:1 (ver seção "Mapeamento para shadcn/ui"). Os componentes do protótipo (`Button`,
`Input`, `Card`, `Badge`, `Modal`/`Dialog`, toasts) correspondem a primitivos shadcn equivalentes.

---

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos e interações são finais.
Recrie a UI fielmente usando os componentes shadcn do projeto. Onde o protótipo usa um
primitivo caseiro, substitua pelo componente shadcn equivalente mantendo o mesmo visual.

---

## Stack & arquitetura sugerida

```
src/
  components/ui/        # shadcn (button, input, card, badge, dialog, select, table, sonner…)
  components/           # AppSidebar, Cover, StockBadge, PaymentRow…
  routes/ (ou pages/)   # Home, Venda, Cadastro, Pesquisa, Relatorios
  lib/db.ts             # acesso ao SQLite (queries)
  lib/format.ts         # BRL(), normalize() p/ busca sem acento
  lib/types.ts          # Book, Pedido, ItemPedido, Pagamento
```

- **Roteamento:** o protótipo usa um estado simples (`route`). Em produção, use
  `react-router` (ou TanStack Router). Rotas: `/` (Início), `/venda`, `/cadastro`,
  `/pesquisa`, `/relatorios`.
- **Estado:** local por tela é suficiente; dados vêm do SQLite. Não há backend HTTP.
- **Tema claro/escuro:** classe `dark` no `<html>` + persistência em `localStorage`
  (chave `eldl-theme`). Em produção, considere `next-themes`-like ou um hook próprio.

---

## Modelo de dados (SQLite)

```sql
CREATE TABLE livro (
  codigo      TEXT PRIMARY KEY,      -- código de barras (EAN-13), ex. '9786556555256'
  titulo      TEXT NOT NULL,
  autor       TEXT,
  preco       REAL NOT NULL DEFAULT 0,
  categoria   INTEGER NOT NULL DEFAULT 0,  -- 0 = Não Categorizado (ver enum abaixo)
  estoque     INTEGER NOT NULL DEFAULT 0,
  descricao   TEXT
);

CREATE TABLE pedido (
  numero      INTEGER PRIMARY KEY,   -- sequencial, começa em ~5996
  cliente     TEXT NOT NULL DEFAULT 'CLIENTE',
  turno       TEXT NOT NULL,         -- 'manha' | 'tarde' (definido pelo horário da venda)
  data        TEXT NOT NULL,         -- ISO yyyy-mm-dd
  total       REAL NOT NULL,
  val_cartao     REAL NOT NULL DEFAULT 0,
  val_dinheiro   REAL NOT NULL DEFAULT 0,
  val_pix        REAL NOT NULL DEFAULT 0,
  val_ministerio REAL NOT NULL DEFAULT 0,
  val_vale       REAL NOT NULL DEFAULT 0
);

CREATE TABLE item_pedido (
  pedido_numero INTEGER NOT NULL REFERENCES pedido(numero),
  codigo        TEXT NOT NULL REFERENCES livro(codigo),
  titulo        TEXT NOT NULL,       -- snapshot do título no momento da venda
  preco         REAL NOT NULL,       -- snapshot do preço
  qtd           INTEGER NOT NULL
);
```

**Categorias (enum numérico — preservar):**
`0 Não Categorizado · 1 Bíblias · 2 Infantil · 3 Família · 4 Devocional · 5 Estudo & Teologia · 6 Ficção`

**Regras de negócio:**
- Ao **Receber**, gravar `pedido` + `item_pedido` e **decrementar `livro.estoque`** pela qtd vendida.
- `numero` do próximo pedido = `MAX(numero)+1`.
- `turno` derivado do horário (manhã antes de ~13h, senão tarde) — usado nos relatórios.

---

## Design tokens

### Cores
Neutros = paleta **zinc** do Tailwind (estilo shadcn "default/zinc"). Marca = **verde**.

| Token | Light | Dark |
|---|---|---|
| Fundo app | `zinc-50` `#fafafa` | `zinc-950` `#09090b` |
| Superfície / Card | `#ffffff` | `zinc-900/60` |
| Borda | `zinc-200` `#e4e4e7` | `zinc-800` `#27272a` |
| Texto principal | `zinc-900` `#18181b` | `zinc-100` `#f4f4f5` |
| Texto secundário | `zinc-500` `#71717a` | `zinc-400` `#a1a1aa` |
| Primário (botão padrão) | `zinc-900` / texto `zinc-50` | `zinc-100` / texto `zinc-900` |
| **Sidebar** (sempre escura) | `zinc-900` `#18181b` | `zinc-950` `#09090b` |
| Destrutivo | `rose-600` `#e11d48` | idem |

**Marca (verde) — escala usada:**
```
brand-50 #ecf7f1 · 100 #d3ecdf · 200 #a9d9bf · 300 #6fc79b · 400 #3fa978
brand-500 #1f7a4d (DEFAULT) · 600 #1a6a43 · 700 #155436 · 800 #12442d · 900 #0f3826
```
Detalhe secundário (acento na logo): dourado `#c79a3a`.

Uso da marca: logo, botão **Receber** (`variant="brand"`), itens de relatório destacados,
links/ações, dot do item de navegação ativo, badge "Editando".

### Semânticas de estoque (badges)
- `estoque <= 0` → **Esgotado** (rose)
- `estoque <= 3` → **Estoque N** (amber)
- senão → **Estoque N** (emerald/green)

### Tipografia
- Sans: **Geist** (300–700). Fallback: `ui-sans-serif, system-ui`.
- Mono: **Geist Mono** (400–600) — usado em **preços, totais, códigos de barras, quantidades, nº de pedido**.
- Escala: títulos de tela `text-xl`/`text-2xl` semibold + `tracking-tight`; corpo `text-sm`;
  rótulos `text-[13px]`; cabeçalhos de tabela/eyebrow `text-[11px] uppercase tracking-wide` em `zinc-500`.

### Raio, sombra, espaçamento
- Raios: campos/botões `rounded-lg` (0.5rem); cards `rounded-xl` (0.75rem); badges `rounded-md`.
- Sombras: `shadow-sm` em cards/campos; `shadow-lg`/`2xl` em dropdowns/modais.
- Espaçamento base: padding de conteúdo `p-6` (telas) e `p-5` (PDV); gaps de `gap-2`…`gap-5`.
- Altura de input/botão padrão: **36px** (`h-9`); botão grande `h-11`; ícones 14–18px.
- **Sidebar: largura 256px (`w-64`), fixa.**

---

## Telas

### 1. Início (`/`)
**Propósito:** visão rápida do dia + atalhos.
**Layout:** header (saudação + nome da loja + data por extizo à direita) → grid de **4 cards de stats**
→ grid de **4 botões de ação** → grid 2 colunas: "Pedidos recentes" (1.3fr) e "Estoque baixo" (1fr).
- **Stats:** Vendas de hoje (soma dos pagamentos), Itens vendidos, Ticket médio, Estoque baixo (qtd `<=3` + esgotados; ícone amber se houver).
- **Ações:** Nova Venda (destaque verde) · Cadastrar Livro · Pesquisar · Relatórios. Hover: `-translate-y-0.5` + `shadow-md`.
- **Estoque baixo:** lista esgotados primeiro, com capa, título, autor e `StockBadge`.

### 2. Venda / PDV (`/venda`) — TELA PRINCIPAL
**Propósito:** registrar a venda. Fluxo **orientado a leitor de código de barras / teclado**.
**Layout:** grid 2 colunas `[1fr 356px]`, altura cheia, `min-width: 1040px`.
- **Coluna esquerda:**
  - Header: título "Venda" + badge `Pedido Nº {n}` (mono) + campo **Cliente** (default "CLIENTE").
  - Card de entrada: **Qtd.** (w-20, número, centralizado, mono) · **Código de Barras**
    (ícone barcode, `autofocus`, **Enter = adicionar**) · botão **Adicionar** (primário).
  - Linha de busca: "Pesquisar para o Pedido Nº {n}" → input **Título ou Autor** com **dropdown**
    de até 6 resultados (capa, título, autor, StockBadge, preço); clique adiciona o item.
  - **Tabela de itens:** colunas `Título | Preço | Quantidade | Total | Remover`
    (`grid-cols-[1fr_96px_128px_100px_52px]`). Cada linha: capa(sm)+título+código(mono),
    preço(mono), **stepper −/N/+**, total(mono), botão remover (softDestructive).
    Estado vazio: ícone de carrinho + "Escaneie um código de barras para começar".
- **Coluna direita (card sticky):**
  - "Resumo do Pedido Nº {n}", cliente, "Títulos: X · Itens: Y".
  - **Total do pedido** (mono, `text-2xl`, bold).
  - **Formas de Pagamento** (fundo levemente afundado): para cada um —
    rótulo c/ ícone · input decimal (`0,00`, alinhado à direita, mono) · botão
    **"Receber R$ {restante}"** (preenche o restante naquele meio).
    Ordem e rótulos exatos: **Cartão · Dinheiro · PIX · Ministério · Vale Presente**.
  - **Pago** e **Troco/Restante** (verde quando há troco, amber quando falta).
  - Botões: **Receber** (`variant="brand"`, grande) e **Apagar Pedido** (softDestructive).
**Validações:** sem itens → erro; `pago < total` → erro "falta R$ …".
**Ao receber:** toast de sucesso, limpa itens/pagamentos, `numero++`, refoca o código de barras.

### 3. Cadastro (`/cadastro`)
**Propósito:** incluir / alterar / excluir livro. Dois estados:
- **Lookup:** campo **Código de Barras** (autofocus, Enter) + botão **Cadastrar/Alterar/Excluir**.
  Se o código existe → abre em modo **edit** (form preenchido); se não → modo **novo** (form em branco
  com o código preenchido). Abaixo: "Cadastrados recentemente" (últimos 4, clicáveis).
- **Formulário:** Título · Autor · Valor (R$, mono) · Estoque (número) ·
  Categoria (`<Select>`, opções "id — nome", legenda "0 = Não Categorizado") · Descrição (textarea).
  Botões: **Cadastrar/Alterar** (brand) · **Excluir** (só em edit, softDestructive) · Cancelar.

### 4. Pesquisa (`/pesquisa`) + 5. Detalhes
**Propósito:** consultar acervo. Card com duas buscas lado a lado:
**Código de Barras** e **Título ou Autor** (cada um com botão Pesquisar; Enter dispara).
- 0 resultados → toast de erro. 1 → abre direto os **Detalhes**. >1 → grid 2-col de cards
  clicáveis (capa md, título, autor, preço, StockBadge).
- **Detalhes:** capa grande (lg) + título, autor, **preço** (mono `text-2xl`), StockBadge,
  e `<dl>`: Categoria, Estoque, **Código de Barras** (mono + botão **Copiar** → clipboard + toast),
  Descrição. Botão "Voltar aos resultados" quando veio de uma lista.

### 6. Relatórios — Login (`/relatorios`)
**Propósito:** autenticar e escolher o relatório. Card com **rádios** agrupados (preservar exatamente):
- **Relatórios de Venda:** Relatório dia Inteiro · Turma da Manhã · Turma da Tarde
- **Relatórios Administrativos:** Relatório Zerado · Relatório de Estoque
- **Inclusão de Usuários (Administrador):** Cadastro Usuário (Administrador)
- Campos: **Data** (date), **Usuário** (default "adm"), **Senha** (password), link "Alterar Senha", botão **Enviar**.
- Rádio = card selecionável (borda/preenchimento brand quando ativo). "usuario" abre fluxo de cadastro de usuário (fora do escopo do protótipo).

### 7. Relatório emitido
- **Vendas (dia/manhã/tarde):** tabela `Código | Título | Qtd × Vlr | Cartão | PIX | Dinheiro | Ministério | Vale Pres.`.
  Itens por pedido, depois **linha "Forma de Pagamento — Pedido N"** (destaque brand) com os valores por meio,
  e ao final linha **Totais**. Abaixo, bloco **"Resumo das Vendas"** com a logo: Total Cartão/PIX/Dinheiro/Ministério/Vale
  e **Sub Total (Dinheiro + Cartão + PIX)** destacado.
- **Estoque:** tabela `Código | Título | Categoria | Preço | Estoque | Valor`, ordenada por estoque crescente;
  cabeçalho mostra "N títulos · Valor em estoque: R$ …".
- **Zerado:** confirmação "Caixa zerado com sucesso" (reinicia totais do turno).
- Todos os relatórios têm **Voltar** e **Imprimir** (em produção: `window.print()` com folha de estilo de impressão, ou export PDF).

---

## Interações & comportamento
- **Foco automático** no código de barras (Venda e Cadastro) e **Enter** confirma — essencial para o leitor.
- **Busca sem acento e sem caixa:** normalizar com `String.normalize('NFD').replace(/[\u0300-\u036f]/g,'')` antes de comparar (ex.: "biblia" acha "Bíblia"). Ver `lib/format.ts → normalize()`.
- **Stepper** de quantidade nunca abaixo de 1; somar quantidade se o mesmo código for adicionado de novo.
- **Cálculo ao vivo:** `pago = Σ pagamentos`; `restante = max(0, total − pago)`; `troco = max(0, pago − total)`.
- **Toasts** (use `sonner` do shadcn): sucesso (check verde), erro (alerta rose), neutro.
- **Animações:** entrada de modal/toast suave (~120–160ms, ease-out). Hover de cards de ação `-translate-y-0.5`. Spinner no "Atualizar Dados".
- **Moeda:** sempre `pt-BR`, 2 casas — `R$ 1.234,56`. Inputs aceitam vírgula decimal.

---

## Mapeamento para shadcn/ui
| Protótipo (`app/ui.jsx`) | shadcn/ui |
|---|---|
| `Button` (default/brand/outline/ghost/destructive/softDestructive/secondary) | `Button` + `variant`s; crie `brand`/`softDestructive` via `cva` |
| `Input`, `Textarea`, `Label` | `Input`, `Textarea`, `Label` |
| `Card` | `Card` (+ `CardHeader/Content`) |
| `Badge`, `StockBadge` | `Badge` + componente `StockBadge` próprio |
| `Modal` | `Dialog` |
| `<select>` nativo (Categoria/Relatório) | `Select` |
| `ToastHost`/`useToast` | `sonner` (`<Toaster/>` + `toast()`) |
| Ícones inline (`app/icons.jsx`, estilo lucide) | `lucide-react` (nomes equivalentes: ShoppingCart, Home, BookPlus, FileBarChart, Search, RefreshCw, Sun, Moon, Barcode, Trash2, Church, Gift, CreditCard, etc.) |
| `BrandMark` | recriar como SVG/componente da logo |
| Tabela do relatório | `Table` do shadcn |

---

## Assets
- **Logo (Espaço do Livro):** o protótipo usa um `BrandMark` SVG recriado (anel verde + 3 barras tipo "páginas", a 3ª dourada). **Substituir pela arte oficial** quando disponível (peça PNG/SVG ao cliente).
- **Capas de livro:** não há imagens cadastradas (legado mostra "Imagem não cadastrada"). O protótipo usa um placeholder `Cover` com iniciais + faixa verde. Suporte futuro a upload de capa é opcional.
- Fontes: Geist / Geist Mono (Google Fonts).

---

## Arquivos de referência neste pacote
- `Espaço do Livro.html` — entrypoint (Tailwind config com a escala `brand`, fontes, ordem dos scripts).
- `app/data.jsx` — catálogo de exemplo, pedidos do dia, enum de categorias, `BRL()`, `normalize()`.
- `app/icons.jsx` — ícones (estilo lucide) + `BrandMark`.
- `app/ui.jsx` — primitivos (Button, Input, Card, Badge, StockBadge, Cover, Modal, Toast).
- `app/screen-venda.jsx` — **PDV** (tela principal).
- `app/screen-home.jsx` — dashboard.
- `app/screen-cadastro.jsx` — cadastro/alterar/excluir.
- `app/screen-pesquisa.jsx` — pesquisa + detalhes.
- `app/screen-relatorio.jsx` — login + relatórios emitidos.
- `app/app.jsx` — shell (sidebar, navegação, tema).

> **Importante:** os dados em `app/data.jsx` são **exemplo**. Em produção tudo vem do **SQLite**.
> Mantenha **rótulos e termos** exatamente como estão (Ministério, Vale Presente, Turma da Manhã/Tarde,
> "Pedido Nº", "0 = Não Categorizado") para não estranhar os usuários.
