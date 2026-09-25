import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { IaAccessService } from "./access.service";
import { IaCatalog } from "./catalog.service";
import { IaGateway } from "./gateway.service";
import { callTool, toolAnnotations, toolDescription, toolInputShape, toolsFor } from "./mcp-tools";

type McpRequest = Request & { body?: unknown };
function publicUrls(req: Request) {
  const origin = String(req.headers["x-ia-public-origin"] || "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:3001").split(",")[0];
  const base = origin || `${proto}://${host}`;
  return { resource: `${base}/mcp`, metadata: `${base}/.well-known/oauth-protected-resource` };
}

@Controller("ia")
export class IaMcpController {
  constructor(@Inject(IaAccessService) private readonly access: IaAccessService,
    @Inject(IaCatalog) private readonly catalog: IaCatalog, @Inject(IaGateway) private readonly gateway: IaGateway) {}

  @All("mcp")
  async mcp(@Req() req: McpRequest, @Res() res: Response) {
    const urls = publicUrls(req);
    let access;
    try {
      access = await this.access.authenticateMcp(req.headers.authorization, urls.resource);
    } catch {
      res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${urls.metadata}"`);
      res.status(401).json({ error: "authorization_required" });
      return;
    }
    const server = new McpServer({ name: "Livraria Espaco do Livro", version: "1.0.0" }, { capabilities: { tools: {} } });
    for (const op of toolsFor(this.catalog, access)) {
      (server.registerTool as unknown as (name: string, config: Record<string, unknown>, cb: (args: unknown) => Promise<unknown>) => unknown)(op.nome, {
        title: `${op.metodo} ${op.rota}`, description: toolDescription(op),
        inputSchema: toolInputShape(op), annotations: toolAnnotations(op),
      }, async args => callTool(args, op, access, this.gateway));
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Erro no MCP da IA externa", error);
      if (!res.headersSent) res.status(500).json({ error: "mcp_unavailable" });
    }
  }
}
