import { describe, expect, it } from "vitest";
import { NAV_ITENS, NAV_ITENS_PDV } from "../../../../../packages/ui/src/nav";
import { payloadStatusDivergencia } from "../estoque_status";

describe("divergencias de estoque", () => {
  it("monta payload resolvido com auditoria", () => {
    expect(payloadStatusDivergencia("resolvida", "u-1", "2026-07-28T10:00:00Z")).toEqual({
      status: "resolvida",
      resolvida_em: "2026-07-28T10:00:00Z",
      resolvida_por: "u-1",
      atualizado_em: "2026-07-28T10:00:00Z",
    });
  });

  it("mantem divergencias no escritorio e fora do PDV", () => {
    expect(NAV_ITENS.some((i) => i.to === "/estoque/divergencias")).toBe(true);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/estoque/divergencias")).toBe(false);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/inventario")).toBe(false);
    expect(NAV_ITENS_PDV.some((i) => i.to === "/lancamentos")).toBe(false);
  });
});
