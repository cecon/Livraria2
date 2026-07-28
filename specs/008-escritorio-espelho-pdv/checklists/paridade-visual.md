# Checklist de paridade visual/navegação (US1 — SC-001/SC-004)

Comparação lado a lado PDV × Escritório. Marcar ao validar cada item.

## Navegação (SC-001 — 100% coincide)

- [x] Barra lateral com os **10 itens** na mesma ordem, rótulo e ícone (fonte única `@livraria/ui/nav`)
- [x] Marca "EL" em `#1f7a4d` + "Espaço do Livro"
- [x] Item ativo destacado (match exato em `/`, prefixo nos demais)
- [x] Rotas resolvem: Início, Cadastro, Pesquisa, Lançamentos, Fornecedores, Relatórios
- [ ] Rotas Venda, Formas de Pagamento, Destinações, Inventário (nascem em US2/US3/US4)

## Tema (SC-004 — mesma identidade)

- [x] Tokens `@theme`/`:root`/`.dark` idênticos (mesmo `@livraria/ui/theme.css`)
- [x] Toggle claro/escuro (Sun/Moon) via `next-themes`, classe `.dark`
- [x] Mesma chave de persistência `eldl-theme` do PDV
- [x] Fonte Geist; cor de marca verde `#1f7a4d`

## Componentes (mesmos shadcn de `@livraria/ui`)

- [x] Button, Input, Label, Table, Card, Badge, Select, Textarea, Sonner — fonte única
- [x] Estados **carregando / vazio** padronizados (`components/estados.tsx`)
- [ ] Estado **erro** padronizado em todas as telas (aplicado por tela conforme US2)

## Telas (conteúdo — migração progressiva)

- [x] Login usa o design system (Button/Input/Label)
- [x] Cadastro migrado (shadcn + camada de dados + estados)
- [ ] Pesquisa, Lançamentos, Fornecedores, Formas de Pagamento, Destinações, Relatórios (US2)

## Notas

- Itens `[ ]` dependem das telas construídas nas US2/US3/US4 — a **casca** (navegação/tema/componentes)
  já está em paridade. Reavaliar SC-001/SC-004 ao fim da US2.
