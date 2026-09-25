const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("MCP OAuth continua registrado na API e exposto pelo web", () => {
  const module = read("apps/nuvem/api/src/operations.module.ts");
  for (const symbol of [
    "IaController",
    "IaMcpController",
    "IaOAuthController",
    "IaAccessService",
    "IaCatalog",
    "IaGateway",
  ]) {
    assert.match(module, new RegExp(`\\b${symbol}\\b`), `${symbol} deve estar registrado em OperationsModule`);
  }

  const webRoutes = [
    "apps/nuvem/web/app/mcp/route.ts",
    "apps/nuvem/web/app/.well-known/oauth-authorization-server/route.ts",
    "apps/nuvem/web/app/.well-known/oauth-protected-resource/route.ts",
  ];
  for (const route of webRoutes) {
    assert.ok(fs.existsSync(path.join(root, route)), `${route} deve existir para clientes MCP descobrirem OAuth`);
  }

  const middleware = read("apps/nuvem/web/middleware.ts");
  assert.match(middleware, /"\/mcp"/, "/mcp deve ser publico no middleware");
  assert.match(middleware, /"\/\.well-known"/, "/.well-known deve ser publico no middleware");
});

