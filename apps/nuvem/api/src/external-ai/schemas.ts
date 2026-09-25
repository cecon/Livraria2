type Schema = Record<string, unknown>;
const text = (maxLength = 500): Schema => ({ type: "string", maxLength });
const id: Schema = { type: "string", format: "uuid" };
const integer: Schema = { type: "integer" };
const cents: Schema = { type: "integer", minimum: 0, description: "Centavos inteiros, nunca reais decimais." };
const bool: Schema = { type: "boolean" };
const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties, required });
const array = (items: Schema): Schema => ({ type: "array", items });
const complement = obj({ editora: text(300), isbn: text(30), custoCentavos: { ...cents, type: ["integer", "null"] },
  capaUrl: text(2000), fontes: array(obj({ nome: text(100), url: text(2000) }, ["nome", "url"])), versao: integer, analisar: bool },
  ["editora", "isbn", "custoCentavos", "capaUrl", "fontes", "versao", "analisar"]);
const book = obj({ sync_uid: id, codigo: text(100), titulo: text(500), autor: text(500), descricao: text(5000),
  preco_centavos: cents, categoria: { type: "integer", minimum: 0, maximum: 6 }, ativo: bool, estoqueInicial: { ...integer, minimum: 0 }, complemento: complement },
  ["codigo", "titulo", "autor", "descricao", "preco_centavos", "categoria"]);
const config = obj({ instrucoes: text(24000), ferramentas: array(text()), skills: array(id), subagentes: array(id),
  politica: { enum: ["alteracoes", "todas"] }, maxIteracoes: integer, contextoMax: integer, tokensMax: integer, saidaMax: integer, tempoMaxSegundos: integer });

export function bodySchema(path: string, method: string): Schema {
  if (path === "/admin/livros/:uid/descricao") return obj({ descricao: text(5000), analisar: bool }, ["descricao"]);
  if (path === "/admin/livros/:uid/capa") return obj({ capaUrl: { ...text(2000), description: "URL HTTPS da capa ou caminho interno /api/capas/{uid}. Use capaUrl ou imagem." }, imagem: { type: "string", maxLength: 5333400, description: "Imagem da capa em data:image/jpeg;base64,..., data:image/png;base64,..., data:image/webp;base64,... ou base64 puro. Use imagem quando não houver URL pública." }, fonteNome: text(100), fonteUrl: text(2000), analisar: bool });
  if (path === "/admin/livros" || path === "/admin/livros/:uid") return { ...book,
    required: [...book.required as string[], ...(method === "POST" ? ["sync_uid"] : [])] };
  if (path.endsWith("/reordenar")) return obj({ uids: array(id) }, ["uids"]);
  if (path.endsWith("/ativa")) return obj({ ativa: bool }, ["ativa"]);
  if (path.endsWith("/senha")) return obj({ senha: text(200) }, ["senha"]);
  if (path.startsWith("/admin/fornecedores")) return obj({ sync_uid: id, nome: text(), documento: text(100), telefone: text(100), email: text(320), observacoes: text(5000), ativo: bool }, ["nome"]);
  if (path.startsWith("/admin/formas")) return obj({ sync_uid: id, rotulo: text(), chave: text(100), ativa: bool, ordem: integer }, ["rotulo", "ativa", "ordem"]);
  if (path.startsWith("/admin/destinacoes")) return obj({ sync_uid: id, nome: text(), ativa: bool, ordem: integer }, ["nome", "ativa", "ordem"]);
  if (path.startsWith("/admin/usuarios")) return obj({ usuario: text(100), nome: text(), perfil: { enum: ["admin", "operador"] }, senha: text(200), ativo: bool });
  if (path === "/admin/estoque/ajustes") return obj({ sync_uid: id, livro_uid: id, qtd: integer, motivo: text() }, ["sync_uid", "livro_uid", "qtd", "motivo"]);
  if (path === "/admin/estoque/contagens") return obj({ itens: array(obj({ sync_uid: id, livro_uid: id, qtd: integer }, ["sync_uid", "livro_uid", "qtd"])) }, ["itens"]);
  if (path === "/admin/lancamentos") return obj({ sync_uid: id }, ["sync_uid"]);
  if (path === "/admin/lancamentos/:uid") return obj({ fornecedor_uid: { ...id, type: ["string", "null"] }, numero: text() });
  if (path.endsWith("/itens")) return obj({ sync_uid: id, livro_uid: id, qtd: { ...integer, minimum: 1 }, custo_unit_centavos: { ...cents, minimum: 1 } }, ["sync_uid", "livro_uid", "qtd", "custo_unit_centavos"]);
  if (path === "/pdvs" || path === "/pdvs/:uid") return obj({ nome: text(100), usuarioUid: id }, ["nome", "usuarioUid"]);
  if (path === "/produtos-pdv") return obj({ operacao: id, uid: id, acao: { enum: ["criar", "editar", "contar"] }, versao: text(), dados: book, quantidade: { ...integer, minimum: 0 } }, ["operacao", "uid", "acao"]);
  if (path === "/admin/llms" || path === "/admin/llms/:uid") return obj({ nome: text(100), provedor: { enum: ["openai-compatible", "google"] }, endereco: text(), modelo: text(), credencial: text(), ativo: bool, pdv: bool, retaguarda: bool, versao: integer });
  if (path === "/admin/agentes" || path === "/admin/agentes/:uid") return obj({ nome: text(), llm_uid: id, execucao: { enum: ["pdv", "retaguarda"] }, config, ativo: bool, versao: integer });
  if (path.includes("/skills")) return obj({ nome: text(), descricao: text(), instrucoes: text(24000), ativo: bool, versao: integer });
  if (path.includes("/mcps") && !path.endsWith("/descobrir")) return obj({ nome: text(), endereco: text(), credencial: text(), ativo: bool, versao: integer });
  if (path === "/agentes/sessoes") return obj({ agenteUid: id, titulo: text() }, ["agenteUid"]);
  if (path.endsWith("/mensagens")) return obj({ requisicaoUid: id, mensagem: text(8000) }, ["requisicaoUid", "mensagem"]);
  if (path.includes("/aprovacoes/")) return obj({ decisao: { enum: ["aprovar", "recusar"] }, resposta: text(4000) }, ["decisao"]);
  if (path === "/agentes/cadastro/sessoes") return obj({ requisicaoUid: id, rascunho: { ...book, required: [] } }, ["requisicaoUid", "rascunho"]);
  if (path === "/agentes/cadastro/analisar") return obj({ livroUid: id }, ["livroUid"]);
  if (path === "/agentes/cadastro/qualidades") return obj({ livroUids: array(id) }, ["livroUids"]);
  if (path === "/agentes/cadastro/fotos") return obj({ requisicaoUid: id, acao: { enum: ["ler", "tratar", "capa"] }, imagem: { type: "string", description: "data:image/jpeg;base64,… PNG/WebP também aceitos; máximo 1,5 MB de bytes." } }, ["requisicaoUid", "acao", "imagem"]);
  return obj({});
}
export function operationNote(path: string) {
  if (path === "/admin/categorias") return "Lista as categorias fixas disponíveis para livros. Use o id retornado no campo categoria; categorias não são editáveis nesta versão.";
  if (path === "/admin/livros/:uid") return "Lê o cadastro completo de um livro, incluindo descrição e complemento com capa, fontes, editora, ISBN, custo e nota. Use antes de editar campos completos para não sobrescrever dados às cegas.";
  if (path === "/admin/livros/:uid/descricao") return "Atualiza somente a descrição/resumo do livro, sem alterar código, preço, categoria ou estoque. Use para texto de contracapa, resumo transcrito por OCR ou descrição validada. analisar=true ou omitido recalcula a nota do cadastro.";
  if (path === "/admin/livros/:uid/capa") return "Atualiza somente a capa do livro por URL HTTPS, caminho interno /api/capas/{uid} ou imagem base64 no campo imagem. URL externa e base64 são gravados no storage interno como /api/capas/{uid}; fonteNome/fonteUrl ficam como referência. Não altera descrição, preço, categoria ou estoque.";
  if (path.startsWith("/admin/livros")) return "Para listar, prefira consulta.busca/codigo/titulo com resumo=1 e limite baixo; sem resumo a resposta traz descrição e complemento. Leia os dados completos antes de editar. Campos básicos são enviados juntos. complemento é opcional; se enviado, preserve sua versao. Criação exige sync_uid novo. Excluir é lógico. Consulte GET /admin/categorias para mapear categoria id→nome; não invente categoria, custo ou dados bibliográficos.";
  if (path.startsWith("/admin/estoque")) return "qtd é a DIFERENÇA assinada de estoque, não o saldo final. Para definir quantidade física total, use POST /produtos-pdv com acao=contar, quantidade total e versao atual. Reutilize sync_uid ao conferir uma tentativa.";
  if (path === "/produtos-pdv") return "Operações idempotentes por operacao (UUID). Consulte GET /produtos-pdv/{uid} para obter a versao atual. contar usa quantidade física total, incluindo zero. Alterações exigem admin.";
  if (path.startsWith("/admin/usuarios") || path.startsWith("/pdvs")) return "Administração de acesso. Pode criar/desativar usuários ou gerar credenciais de máquina permanentes; execute somente quando o humano solicitar expressamente. Não compartilhe credenciais retornadas com outra origem.";
  if (path.startsWith("/agentes")) return "Execução em nome do usuário na retaguarda. Operações podem iniciar tarefas/custos de IA. Polling de sessão/tarefa permite acompanhar o resultado. Sugestões e imagens não salvam o livro automaticamente.";
  if (path.startsWith("/admin/lancamentos")) return "Crie cabeçalho rascunho, atualize fornecedor/numero, inclua itens com UUIDs próprios e finalize explicitamente. Finalização afeta estoque; cancelamento registra estorno.";
  return "Respeita as permissões e validações do sistema. Use os identificadores retornados nas consultas; não invente UUID de registro existente. Em conflito, releia o registro antes de alterar.";
}

