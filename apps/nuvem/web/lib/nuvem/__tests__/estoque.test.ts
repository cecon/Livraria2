import { describe, expect, it } from "vitest";
import { NAV_ITENS, NAV_ITENS_PDV } from "../../../../../packages/ui/src/nav";

describe("navegacao de estoque", () => {
  it("nao expoe a antiga revisao de divergencias", () => {
    expect(NAV_ITENS.some((i) => i.to === "/estoque/divergencias")).toBe(false);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/estoque/divergencias")).toBe(false);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/inventario")).toBe(false);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/lancamentos")).toBe(false);
  });
});
