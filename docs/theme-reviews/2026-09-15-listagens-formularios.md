# Theme Review - Listagens e formularios de cadastro

- Theme reference: `docs/references/theme/app/(dashboard)/users-list/page.tsx`
- Theme reference: `docs/references/theme/components/layout/dashboard-breadcrumb.tsx`
- Theme reference: `docs/references/theme/app/(dashboard)/input-layout/page.tsx`
- Documentation: `docs/references/theme/documentation/index.html`
- AgentMemory query: `listagens formularios breadcrumb WowDash Livraria`

## Evidencias obrigatorias

- [x] AgentMemory recall
- [x] Desktop
- [x] Smartphone
- [x] Light mode
- [x] Dark mode
- [x] Accessibility

## Telas verificadas

| Tela | Lista | Formulario | Smartphone | Resultado |
| --- | --- | --- | --- | --- |
| Livros | Sim | Novo livro | 390 x 844 | Acoes e estoque visiveis sem rolagem horizontal |
| Fornecedores | Sim | Novo fornecedor | 390 x 844 | Telefone incorporado ao resumo no celular |
| Lancamentos | Sim | Rascunho | 390 x 844 | Data, itens, status e total preservados |
| Formas de pagamento | Sim | Nova forma | 390 x 844 | Controles agrupados e sem quebra isolada |
| Destinacoes | Sim | Nova destinacao | 390 x 844 | Ordem, estado e acoes acessiveis |
| Usuarios | Sim | Novo usuario | 390 x 844 | Nome, perfil, estado e acoes visiveis |

## Adaptacao

As telas usam breadcrumb antes do titulo, acao primaria no cabecalho, painel com titulo e descricao,
toolbar de busca, corpo de listagem e rodape de paginacao conforme as referencias do WowDash. Nos
formularios, o breadcrumb e o botao de retorno fecham a edicao sem perder o contexto da lista.

A barra lateral permanece fixa na altura da viewport. As tabelas nao recebem largura minima global:
no smartphone, colunas secundarias migram para o resumo do registro e as acoes permanecem na primeira
visao. Icones possuem nome acessivel, campos mantem labels e o estado atual do breadcrumb usa
`aria-current`.

## Validacao executada

- Desktop: `1024 x 640`, seis listas e seis formularios, sem overflow ou containers rolaveis.
- Smartphone: `390 x 844`, seis listas e seis formularios, sem overflow global.
- Tema escuro: ativado e validado no cadastro em smartphone.
- Navegador: nenhum erro de pagina durante todo o percurso.
