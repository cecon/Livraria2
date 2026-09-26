import { expect, test } from "vitest";

test("encaminhamento generico preserva handlers dinamicos autenticados", async () => {
  // afterFiles e executado antes dos handlers dinamicos do Next.
  const { default: config } = await import("../../../next.config.mjs");
  const routes = await config.rewrites();
  const early = [...routes.beforeFiles, ...(routes.afterFiles ?? [])];
  expect(early.some((route: { source: string }) => route.source === "/api/:path*")).toBe(false);
  expect(routes.fallback).toContainEqual(expect.objectContaining({ source: "/api/:path*" }));
  expect(routes.beforeFiles).toContainEqual(expect.objectContaining({ source: "/api/v1/:path*" }));
});
