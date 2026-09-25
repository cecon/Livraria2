import { describe, expect, it } from "vitest";
import { NAV_ITENS } from "../../../interface/nav";

describe("navegacao de estoque", () => {
  it("nao expoe a antiga revisao de divergencias", () => {
    expect(NAV_ITENS.some((i) => i.to === "/estoque/divergencias")).toBe(false);
  });
});
