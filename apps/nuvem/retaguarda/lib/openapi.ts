type Method = "get" | "post" | "put" | "delete";
type Endpoint = {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth?: "bearer" | "public" | "oauth";
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

const objectSchema = (description: string, properties: Record<string, unknown> = {}) => ({
  type: "object",
  description,
  additionalProperties: true,
  properties,
});

const endpoints: Endpoint[] = [
  { method: "get", path: "/health", tag: "Sistema", summary: "Verifica se a API está online", auth: "public" },
  { method: "post", path: "/auth/login", tag: "Autenticação", summary: "Entra na retaguarda com usuário e senha", auth: "public", body: objectSchema("Credenciais", { usuario: { type: "string" }, senha: { type: "string", format: "password" } }) },
  { method: "get", path: "/auth/me", tag: "Autenticação", summary: "Retorna o usuário autenticado" },
  { method: "put", path: "/auth/senha", tag: "Autenticação", summary: "Troca a senha do usuário atual", body: objectSchema("Senha atual e nova senha") },
  { method: "post", path: "/auth/pdv/renovar", tag: "Autenticação PDV", summary: "Renova a credencial local de uma máquina PDV", body: objectSchema("Token da máquina e contexto do PDV") },
  { method: "get", path: "/pdvs", tag: "Máquinas PDV", summary: "Lista máquinas PDV cadastradas" },
  { method: "post", path: "/pdvs", tag: "Máquinas PDV", summary: "Cadastra uma máquina PDV", body: objectSchema("Nome, loja e permissões da máquina") },
  { method: "post", path: "/pdvs/{uid}/token", tag: "Máquinas PDV", summary: "Gera novo token para uma máquina PDV" },
  { method: "put", path: "/pdvs/{uid}", tag: "Máquinas PDV", summary: "Atualiza uma máquina PDV", body: objectSchema("Dados editáveis da máquina") },
  { method: "post", path: "/pdvs/{uid}/desativar", tag: "Máquinas PDV", summary: "Desativa uma máquina PDV" },
  { method: "get", path: "/sync/catalogo", tag: "Sincronia PDV", summary: "Baixa catálogo, preços, estoque e referências para o PDV", query: { desde: { type: "string", format: "date-time" }, resumo: { type: "boolean" } } },
  { method: "post", path: "/sync/catalogo/confirmacao", tag: "Sincronia PDV", summary: "Confirma recebimento do catálogo pelo PDV", body: objectSchema("Cursor/versão recebida pelo PDV") },
  { method: "post", path: "/sync/vendas", tag: "Sincronia PDV", summary: "Envia uma venda do PDV para a nuvem", body: objectSchema("Venda completa com itens, pagamentos e turno") },
  { method: "post", path: "/sync/vendas/{uid}/cancelamento", tag: "Sincronia PDV", summary: "Cancela uma venda sincronizada", body: objectSchema("Motivo e usuário responsável") },
  { method: "post", path: "/sync/turnos", tag: "Sincronia PDV", summary: "Abre ou atualiza turno do PDV", body: objectSchema("Dados do turno, operador e máquina") },
  { method: "post", path: "/sync/turnos/{uid}/encerramento", tag: "Sincronia PDV", summary: "Encerra turno do PDV", body: objectSchema("Totais, gaveta, malote e conferência") },
  { method: "post", path: "/sync/caixa-movimentos", tag: "Sincronia PDV", summary: "Sincroniza sangrias, suprimentos e movimentos de caixa", body: objectSchema("Movimento de caixa em centavos") },
  { method: "get", path: "/admin/livros", tag: "Livros", summary: "Lista livros com busca e paginação", query: { q: { type: "string" }, codigo: { type: "string" }, resumo: { type: "boolean" }, limite: { type: "integer" }, offset: { type: "integer" } } },
  { method: "post", path: "/admin/livros", tag: "Livros", summary: "Cadastra livro", body: objectSchema("Cadastro do livro; valores monetários em centavos") },
  { method: "put", path: "/admin/livros/{uid}", tag: "Livros", summary: "Atualiza cadastro completo do livro", body: objectSchema("Campos editáveis do livro") },
  { method: "delete", path: "/admin/livros/{uid}", tag: "Livros", summary: "Remove livro quando permitido" },
  { method: "put", path: "/admin/livros/{uid}/capa", tag: "Livros", summary: "Atualiza a capa do livro por URL ou base64", body: objectSchema("Fonte da capa", { capaUrl: { type: "string" }, imagemBase64: { type: "string" }, contentType: { type: "string" }, fonte: { type: "string" } }) },
  { method: "put", path: "/admin/livros/{uid}/descricao", tag: "Livros", summary: "Atualiza a descrição sem sobrescrever o restante do cadastro", body: objectSchema("Descrição, fontes e observações de IA") },
  { method: "get", path: "/produtos-pdv/codigo", tag: "Produtos PDV", summary: "Consulta produto por código de barras para venda", query: { codigo: { type: "string" } } },
  { method: "get", path: "/produtos-pdv/{uid}", tag: "Produtos PDV", summary: "Consulta detalhe de produto usado no PDV" },
  { method: "post", path: "/produtos-pdv", tag: "Produtos PDV", summary: "Cadastro rápido de produto a partir do PDV", body: objectSchema("Produto mínimo para venda") },
  { method: "get", path: "/admin/fornecedores", tag: "Fornecedores", summary: "Lista fornecedores" },
  { method: "post", path: "/admin/fornecedores", tag: "Fornecedores", summary: "Cadastra fornecedor", body: objectSchema("Fornecedor") },
  { method: "put", path: "/admin/fornecedores/{uid}", tag: "Fornecedores", summary: "Atualiza fornecedor", body: objectSchema("Fornecedor") },
  { method: "delete", path: "/admin/fornecedores/{uid}", tag: "Fornecedores", summary: "Remove fornecedor" },
  { method: "get", path: "/admin/destinacoes", tag: "Destinações", summary: "Lista destinações" },
  { method: "post", path: "/admin/destinacoes", tag: "Destinações", summary: "Cadastra destinação", body: objectSchema("Destinação") },
  { method: "put", path: "/admin/destinacoes/reordenar", tag: "Destinações", summary: "Reordena destinações", body: objectSchema("Lista ordenada de UIDs") },
  { method: "put", path: "/admin/destinacoes/{uid}/ativa", tag: "Destinações", summary: "Ativa ou desativa destinação", body: objectSchema("Flag ativa") },
  { method: "put", path: "/admin/destinacoes/{uid}", tag: "Destinações", summary: "Atualiza destinação", body: objectSchema("Destinação") },
  { method: "delete", path: "/admin/destinacoes/{uid}", tag: "Destinações", summary: "Remove destinação" },
  { method: "get", path: "/admin/formas", tag: "Formas de pagamento", summary: "Lista formas de pagamento" },
  { method: "post", path: "/admin/formas", tag: "Formas de pagamento", summary: "Cadastra forma de pagamento", body: objectSchema("Forma de pagamento") },
  { method: "put", path: "/admin/formas/reordenar", tag: "Formas de pagamento", summary: "Reordena formas de pagamento", body: objectSchema("Lista ordenada de UIDs") },
  { method: "put", path: "/admin/formas/{uid}/ativa", tag: "Formas de pagamento", summary: "Ativa ou desativa forma de pagamento", body: objectSchema("Flag ativa") },
  { method: "put", path: "/admin/formas/{uid}", tag: "Formas de pagamento", summary: "Atualiza forma de pagamento", body: objectSchema("Forma de pagamento") },
  { method: "delete", path: "/admin/formas/{uid}", tag: "Formas de pagamento", summary: "Remove forma de pagamento" },
  { method: "get", path: "/admin/lancamentos", tag: "Lançamentos", summary: "Lista notas e lançamentos" },
  { method: "post", path: "/admin/lancamentos", tag: "Lançamentos", summary: "Cria lançamento de nota", body: objectSchema("Cabeçalho do lançamento") },
  { method: "get", path: "/admin/lancamentos/{uid}", tag: "Lançamentos", summary: "Consulta lançamento com itens" },
  { method: "put", path: "/admin/lancamentos/{uid}", tag: "Lançamentos", summary: "Atualiza lançamento", body: objectSchema("Cabeçalho do lançamento") },
  { method: "delete", path: "/admin/lancamentos/{uid}", tag: "Lançamentos", summary: "Remove lançamento" },
  { method: "post", path: "/admin/lancamentos/{uid}/itens", tag: "Lançamentos", summary: "Inclui item no lançamento", body: objectSchema("Item com quantidade e custo em centavos") },
  { method: "delete", path: "/admin/lancamentos/{uid}/itens/{itemUid}", tag: "Lançamentos", summary: "Remove item do lançamento" },
  { method: "post", path: "/admin/lancamentos/{uid}/finalizacao", tag: "Lançamentos", summary: "Finaliza lançamento e movimenta estoque" },
  { method: "post", path: "/admin/lancamentos/{uid}/cancelamento", tag: "Lançamentos", summary: "Cancela lançamento" },
  { method: "get", path: "/admin/estoque/saldos", tag: "Estoque", summary: "Lista saldos de estoque" },
  { method: "get", path: "/admin/estoque/livros/{uid}/movimentos", tag: "Estoque", summary: "Mostra extrato de movimentos de um livro" },
  { method: "post", path: "/admin/estoque/ajustes", tag: "Estoque", summary: "Cria ajuste manual de estoque", body: objectSchema("Produto, quantidade e motivo") },
  { method: "post", path: "/admin/estoque/contagens", tag: "Estoque", summary: "Cria inventário/contagem individual", body: objectSchema("Produto e quantidade contada") },
  { method: "get", path: "/admin/relatorios/estoque", tag: "Relatórios", summary: "Relatório de estoque" },
  { method: "get", path: "/admin/relatorios/estoque/pdf", tag: "Relatórios", summary: "Exporta estoque em PDF" },
  { method: "get", path: "/admin/relatorios/estoque/xlsx", tag: "Relatórios", summary: "Exporta estoque em XLSX" },
  { method: "get", path: "/admin/relatorios/destinacoes", tag: "Relatórios", summary: "Relatório por destinação" },
  { method: "get", path: "/admin/relatorios/vendas", tag: "Relatórios", summary: "Relatório de vendas" },
  { method: "get", path: "/admin/relatorios/dashboard", tag: "Relatórios", summary: "Indicadores do painel inicial" },
  { method: "get", path: "/admin/turnos", tag: "Turnos", summary: "Lista turnos sincronizados" },
  { method: "get", path: "/admin/vendas/hoje", tag: "Vendas", summary: "Lista vendas do dia para a retaguarda" },
  { method: "get", path: "/admin/usuarios", tag: "Usuários", summary: "Lista usuários" },
  { method: "post", path: "/admin/usuarios", tag: "Usuários", summary: "Cria usuário", body: objectSchema("Usuário, senha e perfil") },
  { method: "put", path: "/admin/usuarios/{usuario}", tag: "Usuários", summary: "Atualiza usuário", body: objectSchema("Dados do usuário") },
  { method: "put", path: "/admin/usuarios/{usuario}/senha", tag: "Usuários", summary: "Altera senha de usuário", body: objectSchema("Nova senha") },
  { method: "put", path: "/admin/usuarios/{usuario}/ativa", tag: "Usuários", summary: "Ativa ou desativa usuário", body: objectSchema("Flag ativa") },
  { method: "get", path: "/admin/llms", tag: "LLMs", summary: "Lista configurações de LLM" },
  { method: "post", path: "/admin/llms", tag: "LLMs", summary: "Cadastra provedor/modelo de LLM", body: objectSchema("Provedor, modelo, credencial e escopos") },
  { method: "put", path: "/admin/llms/{uid}", tag: "LLMs", summary: "Atualiza LLM cadastrada", body: objectSchema("Configuração de LLM") },
  { method: "post", path: "/admin/llms/{uid}/testar", tag: "LLMs", summary: "Testa conexão com a LLM" },
  { method: "get", path: "/llms", tag: "LLMs", summary: "Lista LLMs disponíveis para uso" },
  { method: "post", path: "/llms/{uid}/testar", tag: "LLMs", summary: "Testa LLM no contexto do usuário" },
  { method: "post", path: "/ia/solicitacoes", tag: "IA externa", summary: "Cria solicitação de acesso temporário para ChatGPT/Claude", auth: "public", body: objectSchema("Escopos e justificativa solicitados") },
  { method: "get", path: "/ia/solicitacoes/{uid}", tag: "IA externa", summary: "Consulta status de uma solicitação de acesso", auth: "public" },
  { method: "post", path: "/ia/autorizar", tag: "IA externa", summary: "Autoriza solicitação após login humano", body: objectSchema("Usuário, senha e solicitação") },
  { method: "get", path: "/ia/catalogo", tag: "IA externa", summary: "Lista APIs disponíveis para uma IA autorizada", auth: "bearer" },
  { method: "post", path: "/ia/executar", tag: "IA externa", summary: "Executa uma ação permitida em nome do usuário autorizado", auth: "bearer", body: objectSchema("Nome da ação e argumentos") },
  { method: "get", path: "/ia/acessos", tag: "IA externa", summary: "Lista acessos temporários concedidos" },
  { method: "post", path: "/ia/acessos/{uid}/revogar", tag: "IA externa", summary: "Revoga acesso temporário de IA" },
  { method: "get", path: "/ia/acessos/{uid}/historico", tag: "IA externa", summary: "Mostra histórico de chamadas de uma IA" },
  { method: "get", path: "/ia/oauth/protected-resource", tag: "OAuth MCP", summary: "Metadados de recurso protegido para clientes MCP", auth: "public" },
  { method: "get", path: "/ia/oauth/metadata", tag: "OAuth MCP", summary: "Metadados OAuth/OIDC publicados para MCP", auth: "public" },
  { method: "post", path: "/ia/oauth/register", tag: "OAuth MCP", summary: "Registro dinâmico de cliente OAuth", auth: "public", body: objectSchema("Client metadata do cliente MCP") },
  { method: "get", path: "/ia/oauth/authorize", tag: "OAuth MCP", summary: "Inicia autorização OAuth PKCE para MCP", auth: "public" },
  { method: "post", path: "/ia/oauth/authorize", tag: "OAuth MCP", summary: "Confirma login humano e emite authorization code", auth: "public", body: objectSchema("Credenciais humanas e parâmetros OAuth") },
  { method: "post", path: "/ia/oauth/token", tag: "OAuth MCP", summary: "Troca authorization code por access token", auth: "public", body: objectSchema("grant_type, code, redirect_uri, client_id e code_verifier") },
  { method: "post", path: "/ia/mcp", tag: "MCP", summary: "Endpoint JSON-RPC do servidor MCP", auth: "oauth", body: objectSchema("Mensagem JSON-RPC MCP") },
  { method: "get", path: "/agentes", tag: "Agentes", summary: "Lista agentes disponíveis" },
  { method: "get", path: "/agentes/sessoes", tag: "Agentes", summary: "Lista sessões de agentes" },
  { method: "post", path: "/agentes/sessoes", tag: "Agentes", summary: "Cria sessão de agente", body: objectSchema("Agente, modo PDV/retaguarda e contexto inicial") },
  { method: "get", path: "/agentes/sessoes/{uid}", tag: "Agentes", summary: "Consulta sessão de agente" },
  { method: "post", path: "/agentes/sessoes/{uid}/mensagens", tag: "Agentes", summary: "Envia mensagem e executa loop básico do agente", body: objectSchema("Mensagem do usuário e anexos") },
  { method: "post", path: "/agentes/execucoes/{uid}/cancelar", tag: "Agentes", summary: "Cancela execução de agente" },
  { method: "post", path: "/agentes/aprovacoes/{uid}/responder", tag: "Agentes", summary: "Responde aprovação humana solicitada pelo agente", body: objectSchema("Decisão e observação") },
  { method: "get", path: "/agentes/trabalhos", tag: "Agentes", summary: "Lista trabalhos em segundo plano dos agentes" },
  { method: "post", path: "/agentes/execucoes/{uid}/local/assumir", tag: "Agentes PDV", summary: "PDV assume execução local pendente" },
  { method: "post", path: "/agentes/execucoes/{uid}/local/inferir", tag: "Agentes PDV", summary: "PDV envia resultado de inferência local", body: objectSchema("Resultado da LLM/ferramenta local") },
  { method: "post", path: "/agentes/execucoes/{uid}/local/chamadas/{chamada}/{acao}", tag: "Agentes PDV", summary: "PDV responde chamada local de ferramenta", body: objectSchema("Resultado ou erro da chamada") },
  { method: "get", path: "/admin/agentes/mcps", tag: "Admin agentes", summary: "Lista servidores MCP cadastrados" },
  { method: "post", path: "/admin/agentes/mcps", tag: "Admin agentes", summary: "Cadastra servidor MCP", body: objectSchema("Nome, URL, autenticação e escopos") },
  { method: "put", path: "/admin/agentes/mcps/{uid}", tag: "Admin agentes", summary: "Atualiza servidor MCP", body: objectSchema("Configuração do MCP") },
  { method: "post", path: "/admin/agentes/mcps/{uid}/descobrir", tag: "Admin agentes", summary: "Descobre tools disponíveis em um MCP" },
  { method: "post", path: "/agentes/cadastro", tag: "Assistente de cadastro", summary: "Executa assistência de IA no cadastro de livro", body: objectSchema("Título, código, imagem ou instrução do cadastro") },
];

const operation = (endpoint: Endpoint) => ({
  tags: [endpoint.tag],
  summary: endpoint.summary,
  description: endpoint.description ?? endpoint.summary,
  security: endpoint.auth === "public" ? [] : [{ bearerAuth: [] }],
  parameters: [
    ...Array.from(endpoint.path.matchAll(/\{([^}]+)\}/g)).map((match) => ({ name: match[1], in: "path", required: true, schema: { type: "string" } })),
    ...Object.entries(endpoint.query ?? {}).map(([name, schema]) => ({ name, in: "query", required: false, schema })),
  ],
  ...(endpoint.body ? { requestBody: { required: true, content: { "application/json": { schema: endpoint.body } } } } : {}),
  responses: {
    "200": { description: "Operação realizada", content: { "application/json": { schema: objectSchema("Resposta") } } },
    "400": { description: "Parâmetros inválidos" },
    "401": { description: "Sessão ou token inválido" },
    "403": { description: "Sem permissão" },
    "404": { description: "Recurso não encontrado" },
  },
});

export function createOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    const fullPath = `/api/v1${endpoint.path}`;
    paths[fullPath] = { ...(paths[fullPath] ?? {}), [endpoint.method]: operation(endpoint) };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Livraria — API da Nuvem",
      version: "1.0.0",
      description: "Documentação operacional dos endpoints da retaguarda, sincronia PDV, IA externa, OAuth MCP e agentes.",
    },
    servers: [{ url: "https://livraria.c3bot.com", description: "Produção" }, { url: "http://localhost:3001", description: "API local" }],
    tags: Array.from(new Set(endpoints.map((endpoint) => endpoint.tag))).sort().map((name) => ({ name })),
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT/OAuth" } } },
    paths,
  };
}
