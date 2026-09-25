import { Inject, Injectable, OnApplicationBootstrap, RequestMethod } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { IaAccess } from "./access.service";
import { bodySchema, operationNote } from "./schemas";

export type IaOperation = { metodo: string; rota: string; nome: string; administrador: boolean; parametros: string[]; consulta: string[]; corpo: boolean };
const bases = new Set(["admin/categorias", "admin/livros", "admin/fornecedores", "admin/formas", "admin/destinacoes", "admin/estoque",
  "admin/lancamentos", "admin/turnos", "admin/vendas", "admin/relatorios", "admin/usuarios", "pdvs", "produtos-pdv",
  "admin/llms", "llms", "admin/agentes", "agentes", "agentes/cadastro"]);
const mcpRoutes = new Set([
  "GET /admin/categorias", "GET /admin/livros", "GET /admin/livros/:uid", "POST /admin/livros", "PUT /admin/livros/:uid",
  "PUT /admin/livros/:uid/descricao", "PUT /admin/livros/:uid/capa", "GET /admin/estoque/saldos",
  "GET /admin/estoque/livros/:uid/movimentos", "POST /admin/estoque/ajustes", "POST /admin/estoque/contagens",
  "POST /agentes/cadastro/analisar", "POST /agentes/cadastro/qualidades", "POST /agentes/cadastro/fotos",
  "POST /agentes/cadastro/sessoes", "GET /admin/fornecedores", "GET /admin/formas", "GET /admin/destinacoes",
  "GET /admin/relatorios/dashboard", "GET /admin/relatorios/estoque", "GET /admin/vendas/hoje", "GET /admin/turnos",
]);
@Injectable()
export class IaCatalog implements OnApplicationBootstrap {
  private operations: IaOperation[] = [];
  constructor(@Inject(ModulesContainer) private readonly modules: ModulesContainer) {}
  onApplicationBootstrap() {
    const found = new Map<string, IaOperation>();
    for (const module of this.modules.values()) for (const wrapper of module.controllers.values()) {
      const type = wrapper.metatype;
      if (!type) continue;
      const base = Reflect.getMetadata(PATH_METADATA, type);
      if (typeof base !== "string" || !bases.has(base)) continue;
      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = Object.getOwnPropertyDescriptor(type.prototype, name)?.value;
        if (typeof handler !== "function") continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler), suffix = Reflect.getMetadata(PATH_METADATA, handler);
        if (method === undefined || typeof suffix !== "string") continue;
        const route = "/" + [base, suffix].filter(s => s && s !== "/").join("/");
        const verb = RequestMethod[method];
        if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(verb)) continue;
        // Device sync and local runners require a machine identity, never impersonated here.
        if (route.includes("/local/") || route === "/agentes/trabalhos") continue;
        const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, type, name) || {};
        const query = Object.entries(args).filter(([key]) => key.startsWith("4:"))
          .map(([, value]) => (value as { data?: string }).data).filter((v): v is string => !!v && v !== "turnoUid");
        const op = { metodo: verb, rota: route, nome: `${verb.toLowerCase()}_${route.replace(/[^A-Za-z0-9]+/g, "_")}`,
          administrador: base.startsWith("admin/") || base === "pdvs" || base === "produtos-pdv",
          parametros: [...route.matchAll(/:([A-Za-z]+)/g)].map(m => m[1]), consulta: query,
          corpo: Object.keys(args).some(key => key.startsWith("3:")) };
        found.set(`${verb} ${route}`, op);
      }
    }
    this.operations = [...found.values()].sort((a, b) => b.rota.split("/").filter(v => !v.startsWith(":")).length - a.rota.split("/").filter(v => !v.startsWith(":")).length);
  }
  available(access: IaAccess) {
    return this.operations.filter(op => (!op.administrador || access.perfil === "admin") && (access.modo === "alteracao" || op.metodo === "GET"));
  }
  mcpTools(access: IaAccess) {
    return this.available(access).filter(op => mcpRoutes.has(`${op.metodo} ${op.rota}`));
  }
  find(method: string, path: string, access: IaAccess) {
    return this.available(access).find(op => op.metodo === method && new RegExp("^" + op.rota.replace(/:[A-Za-z]+/g, "[A-Za-z0-9._-]+") + "$").test(path));
  }
  document(access: IaAccess) {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const op of this.available(access)) {
      const path = op.rota.replace(/:([A-Za-z]+)/g, "{$1}");
      (paths[path] ??= {})[op.metodo.toLowerCase()] = {
        operationId: op.nome, summary: `${op.metodo} ${op.rota}`, description: operationNote(op.rota),
        parameters: [...op.parametros.map(name => ({ name, in: "path", required: true, schema: { type: "string" } })),
          ...op.consulta.map(name => ({ name, in: "query", schema: { type: "string" } }))],
        ...(op.corpo && { requestBody: { required: true, content: { "application/json": { schema: bodySchema(op.rota, op.metodo) } } } }),
        responses: { "200": { description: "Resultado; listas podem ser paginadas com items/next. Valores monetários em centavos inteiros." },
          "201": { description: "Criado" }, "202": { description: "Enfileirado; consulte a sessão/tarefa" },
          "400": { description: "Confira os campos informados" }, "401": { description: "Token ausente, expirado ou revogado" },
          "403": { description: "Operação fora das permissões do usuário ou do token" }, "409": { description: "Conflito; releia o registro antes de tentar novamente" } },
      };
    }
    return { openapi: "3.1.0", info: { title: "Livraria — acesso temporário para IA", version: "1.0.0",
      description: "APIs disponíveis para este token. Authorization: Bearer lia_… em toda chamada. Nunca envie o token a outra origem. Preços/custos são centavos inteiros; UUIDs e versões devem ser preservados em tentativas repetidas. Não repita mutações após timeout sem consultar o resultado. Ações críticas devem seguir o pedido explícito do humano." },
      servers: [{ url: "/api/ia/v1" }], security: [{ tokenTemporario: [] }],
      components: { securitySchemes: { tokenTemporario: { type: "http", scheme: "bearer", bearerFormat: "lia_token" } } },
      "x-acesso": { modo: access.modo, expiraEm: access.expira_em }, paths };
  }
}

