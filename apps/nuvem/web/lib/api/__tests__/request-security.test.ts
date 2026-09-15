import { describe, expect, it } from "vitest";
import { requestUsesHttps } from "../request-security";

function request(protocol: string, forwarded: string | null = null) {
  return {
    headers: { get: (name: string) => name === "x-forwarded-proto" ? forwarded : null },
    nextUrl: { protocol },
  };
}

describe("requestUsesHttps", () => {
  it("permite o cookie de sessao na previa HTTP local", () => {
    expect(requestUsesHttps(request("http:"))).toBe(false);
  });

  it("mantem o cookie seguro em HTTPS direto", () => {
    expect(requestUsesHttps(request("https:"))).toBe(true);
  });

  it("respeita HTTPS informado pelo proxy", () => {
    expect(requestUsesHttps(request("http:", "https"))).toBe(true);
  });
});
