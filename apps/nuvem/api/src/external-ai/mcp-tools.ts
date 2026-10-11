import { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { IaAccess } from "./access.service";
import { IaCatalog, IaOperation } from "./catalog.service";
import { IaGateway } from "./gateway.service";
import { bodySchema, operationNote } from "./schemas";

type Schema = Record<string, unknown>;
const text: Schema = { type: "string" };
const object = (properties: Record<string, Schema>, required: string[] = []): Schema =>
  ({ type: "object", properties, required, additionalProperties: false });
const key = (op: IaOperation) => `${op.metodo} ${op.rota}`;
const purposes: Record<string, string> = {
  "GET /admin/categorias": "Lista o enum fixo de categorias de livro, com id e nome. Use antes de cadastrar ou editar livro para escolher o número correto; categorias não são editáveis/adicionáveis nesta versão.",
  "GET /admin/livros": "Busca livros/produtos do catálogo por código, ISBN, título, autor ou descrição e já devolve o saldo de estoque atual de cada um (campo saldo). Use para ver o estoque de um livro pelo nome, antes de ajustar estoque, editar ou conferir se o livro já existe. Sempre informe consulta.busca (palavras do título/descrição) ou consulta.codigo.",
  "GET /admin/livros/:uid": "Lê um livro completo pelo UUID, com descrição e saldo de estoque atual. Use antes de editar o cadastro para não sobrescrever dados às cegas.",
  "POST /admin/livros": "Cria um novo livro/produto no cadastro oficial. Use somente quando o humano pediu cadastro ou quando a busca confirmou que o item não existe. Exige UUID novo em sync_uid, código, título, preço em centavos e categoria.",
  "PUT /admin/livros/:uid": "Edita o cadastro completo de um livro existente. Use quando precisar alterar vários campos juntos; para mudar só o resumo, prefira a ferramenta de descrição.",
  "PUT /admin/livros/:uid/descricao": "Adiciona ou troca somente a descrição/resumo do livro. Ideal para texto de contracapa, OCR, resumo validado pela web ou conteúdo que depois alimentará RAG. Não altera preço, categoria, estoque ou código.",
  "PUT /admin/livros/:uid/capa": "Adiciona ou troca somente a capa do livro. Aceita capaUrl com URL HTTPS/caminho /api/capas/{uid} ou imagem base64 no campo imagem; o backend grava no storage interno e retorna /api/capas/{uid}. Use quando encontrou capa oficial, gerou capa interna ou recebeu arquivo/foto. Não exige nem sobrescreve descrição.",
  "GET /admin/estoque/saldos": "Lista o saldo de TODOS os livros (livro_uid, codigo, titulo, saldo), sem filtro. Para um livro específico prefira GET /admin/livros com consulta.busca, que já traz o saldo.",
  "GET /admin/estoque/livros/:uid/movimentos": "Lista o histórico de movimentos de estoque de um livro específico. Use para explicar por que o saldo mudou.",
  "POST /admin/estoque/ajustes": "Ajusta o estoque de um livro somando qtd (diferença assinada, nunca o saldo final): qtd=-2 tira duas unidades, qtd=3 acrescenta três. Para deixar o saldo em N, leia o saldo atual S e envie qtd=N-S (não envie se for zero). motivo é obrigatório e sync_uid é um UUID novo por ajuste.",
  "POST /admin/estoque/contagens": "Registra um inventário de vários livros de uma vez. Cada qtd também é a DIFERENÇA (contado menos saldo atual), não a quantidade contada; omita itens sem diferença. Para um livro só, prefira o ajuste com motivo.",
  "POST /agentes/cadastro/analisar": "Recalcula a qualidade do cadastro de um livro e aponta pendências como descrição, autor, custo, editora, capa e fontes.",
  "POST /agentes/cadastro/qualidades": "Consulta a nota e pendências de qualidade de vários livros sem alterar cadastro.",
  "POST /agentes/cadastro/fotos": "Processa imagem de capa ou contracapa. Use para OCR de dados bibliográficos, tratamento de capa ou geração de arquivo de capa.",
  "POST /agentes/cadastro/sessoes": "Inicia uma sessão do assistente de cadastro com um rascunho de livro. Use quando a conversa precisa guiar o humano pelo cadastro.",
  "GET /admin/fornecedores": "Lista fornecedores cadastrados para vincular lançamentos/notas ou validar nomes.",
  "GET /admin/formas": "Lista formas de pagamento ativas e sua ordem.",
  "GET /admin/destinacoes": "Lista destinos/categorias de doação ou saída.",
  "GET /admin/relatorios/dashboard": "Consulta indicadores resumidos da retaguarda para visão geral do negócio.",
  "GET /admin/relatorios/estoque": "Relatório completo de estoque de livros ativos (código, título, preço, estoque e valor) com total geral. Resposta grande; para um livro use GET /admin/livros com busca.",
  "GET /admin/relatorios/livros-vendidos": "Lista os livros vendidos num período, agregados por livro (qtd, valor em centavos, nº de pedidos), do mais vendido ao menos vendido. Pedidos cancelados ficam fora. Use para perguntas como 'quais livros vendi', 'mais vendidos do mês' ou 'quantos exemplares de X saíram'.",
  "GET /admin/relatorios/vendas": "Lista os pedidos de UM dia com itens, cliente, recebimentos e totais por forma de pagamento. Use para detalhar as vendas de uma data.",
  "GET /admin/vendas/hoje": "Lista os pedidos de hoje vindos dos caixas (número, total, máquina, operador), sem os livros. Para saber quais livros saíram use GET /admin/relatorios/livros-vendidos.",
  "GET /admin/turnos": "Lista turnos de caixa conhecidos na nuvem.",
};
const date = (description: string): Schema => ({ ...text, pattern: "^\\d{4}-\\d{2}-\\d{2}$", description });
const reportQueries: Record<string, Record<string, Schema>> = {
  "/admin/relatorios/livros-vendidos": {
    inicio: date("Data inicial AAAA-MM-DD (fuso de São Paulo). Obrigatória."),
    fim: date("Data final AAAA-MM-DD, inclusive. Omitida = mesma data de inicio. Período máximo de um ano."),
    busca: { ...text, description: "Filtra por parte do título ou código vendido." },
  },
  "/admin/relatorios/vendas": {
    data: date("Dia AAAA-MM-DD. Obrigatório."),
    periodo: { ...text, enum: ["dia", "manha", "tarde"], description: "Use dia para o dia inteiro." },
  },
  "/admin/relatorios/dashboard": { periodo: { ...text, enum: ["hoje", "7dias", "mes", "ano"] } },
  "/admin/relatorios/destinacoes": { inicio: date("Data inicial AAAA-MM-DD."), fim: date("Data final AAAA-MM-DD.") },
};
const queryProperty = (op: IaOperation, name: string): Schema => {
  if (reportQueries[op.rota]?.[name]) return reportQueries[op.rota][name];
  if (op.metodo === "GET" && op.rota === "/admin/livros") {
    const notes: Record<string, Schema> = {
      busca: { ...text, description: "Palavras do título, autor, descrição ou código; todas precisam aparecer, sem diferenciar acento." },
      codigo: { ...text, description: "Filtro por código, ISBN, EAN ou código interno." },
      titulo: { ...text, description: "Filtro por parte do título." },
      limite: { ...text, description: "Quantidade máxima de itens, de 1 a 500. Para MCP, prefira até 50." },
      resumo: { ...text, enum: ["1"], description: "Use 1 para omitir a descrição (padrão no MCP)." },
      after: { ...text, description: "Cursor UUID retornado em next para paginação." },
      inativos: { ...text, enum: ["1"], description: "Use 1 para incluir livros inativos." },
    };
    return notes[name] || text;
  }
  return text;
};

export function toolSchema(op: IaOperation): Schema {
  const properties: Record<string, Schema> = {};
  for (const name of op.parametros) properties[name] = { ...text, description: `Valor de :${name} na rota ${op.rota}` };
  if (op.consulta.length) properties.consulta = object(Object.fromEntries(op.consulta.map(name => [name, queryProperty(op, name)])));
  if (op.corpo) properties.corpo = bodySchema(op.rota, op.metodo);
  return object(properties, op.parametros);
}

export function toolInputShape(op: IaOperation) {
  const shape: Record<string, z.ZodType> = {};
  for (const name of op.parametros) shape[name] = z.string().describe(`Valor de :${name} na rota ${op.rota}`);
  if (op.consulta.length) shape.consulta = z.object(Object.fromEntries(op.consulta.map(name =>
    [name, z.string().optional().describe(String(queryProperty(op, name).description || `Consulta ${name}`))]))).optional()
      .describe(`Consulta: ${op.consulta.join(", ")}`);
  if (op.corpo) shape.corpo = z.any().optional().describe(`Corpo JSON conforme este schema: ${JSON.stringify(bodySchema(op.rota, op.metodo))}`);
  return shape;
}

export function toolAnnotations(op: IaOperation): ToolAnnotations {
  return { title: `${op.metodo} ${op.rota}`, readOnlyHint: op.metodo === "GET",
    destructiveHint: ["DELETE", "PATCH", "PUT", "POST"].includes(op.metodo),
    idempotentHint: ["GET", "PUT"].includes(op.metodo), openWorldHint: false };
}

export function toolDescription(op: IaOperation) {
  const schema = JSON.stringify(toolSchema(op));
  return `${purposes[key(op)] || operationNote(op.rota)} Parâmetros esperados: ${schema}`;
}

export async function callTool(args: unknown, op: IaOperation, access: IaAccess, gateway: IaGateway): Promise<CallToolResult> {
  const input = typeof args === "object" && args ? args as Record<string, unknown> : {};
  let path = op.rota;
  for (const name of op.parametros) {
    const value = input[name];
    if (typeof value !== "string" || !/^[A-Za-z0-9._-]+$/.test(value)) throw new Error(`Parâmetro ${name} inválido.`);
    path = path.replace(`:${name}`, value);
  }
  const consulta = { ...(op.metodo === "GET" && op.rota === "/admin/livros" ? { resumo: "1", limite: "50" } : {}),
    ...(typeof input.consulta === "object" && input.consulta ? input.consulta as Record<string, unknown> : {}) };
  const result = await gateway.execute({ metodo: op.metodo, rota: path, consulta, corpo: input.corpo }, access);
  const raw = result.bytes.toString("utf8");
  const text = raw.length > 120000 ? raw.slice(0, 120000) + "\n… resposta truncada para o chat." : raw;
  return { isError: result.status >= 400, content: [{ type: "text", text: `HTTP ${result.status}\n${text}` }] };
}

export function toolsFor(catalog: IaCatalog, access: IaAccess) {
  return catalog.mcpTools(access);
}

