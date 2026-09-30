# Retaguarda Able Pro

Decisão: [ADR-0040](adr/0040-retaguarda-able-pro.md). Código em
`apps/nuvem/retaguarda`; não existe uma segunda aplicação web legada.
O workspace npm continua se chamando `livraria-escritorio`, preservando comandos.
Docker, Compose, CI, testes e documentação usam a pasta nova.

## Estrutura

- `interface/able-pro`: paleta e tipografia do seed TypeScript 9.2.2, tema MUI e navegação própria.
- `interface/ui`: controles locais MUI; contratos de interação preservados para as telas.
- `components`: shell, menu, autenticação, cards e componentes dos fluxos da livraria.
- `app`: rotas existentes, incluindo os handlers autenticados, imagens e OAuth/MCP.
- `lib`: clientes e contratos da API mantidos. A interface não acessa PostgreSQL diretamente.

O seed Vite foi adaptado ao Next.js existente para preservar cookies HttpOnly,
proxies e endpoints usados pelo PDV e pelo MCP. Não foram importados login de
demonstração, menus fictícios, gráficos com dados inventados ou provedores do template.
O PDV conserva sua interface; o Cloud não depende mais de `@livraria/ui`.

## Inventário das telas

| Rota | Fluxos preservados |
|---|---|
| `/` | Indicadores reais por período, estoque baixo e atalhos |
| `/cadastro` | Listar, filtrar ativos/inativos, cadastrar, editar, ativar, excluir e enviar/remover capa |
| `/pesquisa` | Código/título/autor, capa, detalhes, ajuste de estoque e extrato |
| `/lancamentos` | Rascunho, fornecedor, itens, ativação confirmada, finalização e cancelamento |
| `/inventario` | Contagem parcial/total, rascunho local, revisão e aplicação dos ajustes |
| `/fornecedores` | Cadastro, edição, busca e exclusão |
| `/formas-pagamento` | Criar, renomear, ordenar e ativar; proteção das formas de sistema |
| `/destinacoes` | Criar, renomear, ordenar e ativar; proteção dos destinos de sistema |
| `/venda` e `/turnos` | Consulta das operações recebidas dos PDVs e atualização automática |
| `/relatorios` | Vendas, destinações, estoque e exportações existentes |
| `/pdvs` | Máquinas, operador vinculado, credenciais e desativação |
| `/usuarios` | Usuários, perfis, senha, ativação e proteção do último administrador |
| `/llms` | Modelos/provedores, disponibilidade, credenciais protegidas e teste de conexão |
| `/login`, `/trocar-senha` | Sessão e autenticação reais da API |
| `/ia/conectar` | Consentimento OAuth do MCP |
| `/swagger` | Documentação técnica da API |

## Correções observadas na migração

O encaminhamento antecipado de `/api/pdvs` ignorava o handler com cookie de sessão:
foi removido, mantendo a API pública em `/api/v1/pdvs` e o provisionamento existente.
O dashboard agora distingue falha de carregamento de valores zerados. A pesquisa
aguarda o catálogo antes de habilitar consultas. Novo livro sem estoque continua
seguindo a regra vigente da API (inativo), com mensagem indicando onde ativá-lo.
Ativar um livro existente com saldo zero permanece permitido.

O tema escuro é aplicado após hidratação para manter HTML consistente. Rótulos,
seletores, menu móvel, submissão dos formulários e contraste foram revisados.
Tons mais escuros da própria paleta são usados onde necessário para legibilidade.

## Validação reproduzível

`npm run build:web`, `npm run build:api`, `npm run test:api -w livraria-escritorio`
e `npm run theme:test`. O CI também compila a retaguarda e executa os testes dos
proxies contra Next.js real (`API_WEB_E2E=true`).

Os testes de API em `apps/nuvem/api/tests` recriam **somente** o PostgreSQL isolado
`livraria-separacao-db`, porta 55439, banco `livraria_test`.
Nunca apontar esses testes para a loja. Depois deles, preparar um administrador
de teste e iniciar a API na porta 3003 e a retaguarda na porta 3025, com
`NUVEM_API_URL=http://127.0.0.1:3003` também durante o build local.

Executar `npm run test:browser -w livraria-escritorio` com:

- `API_TEST_DATABASE=isolated-local` e `UI_TEST_URL=http://127.0.0.1:3025`;
- `UI_TEST_USER` e `UI_TEST_PASSWORD` do administrador isolado;
- Chromium instalado por `npx playwright install chromium`, ou `PLAYWRIGHT_EXECUTABLE_PATH`;
- `UI_TEST_OUTPUT` opcional para screenshots e relatório Axe (padrão `test-results/able-pro`).

Os testes criam dados apenas no banco isolado e verificam as 14 telas principais
em 1440px/390px, claro/escuro, ausência de erros JavaScript/HTTP e acessibilidade
WCAG A/AA automatizada. Os fluxos incluem imagem, ativação com saldo zero,
entrada de 30 unidades a R$ 10, contagem, fornecedor, usuário, formas/destinações,
máquina, modelo LLM, PDF/XLSX, login/logout e proteção do MCP.
Não fazem chamadas pagas de geração de IA nem transações de teste em produção.

Publicação e reversão seguem [o runbook Dokploy](deploy-dokploy.md), mantendo os
nomes das imagens e serviços existentes. Não há migração de dados por causa do tema.
