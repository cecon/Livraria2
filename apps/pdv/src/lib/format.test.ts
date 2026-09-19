import { describe, expect, it } from "vitest";
import { parseBrlParaCentavos } from "./format";

describe("parseBrlParaCentavos", () => {
  it("converte o troco inicial em centavos inteiros", () => {
    expect(parseBrlParaCentavos("R$ 1.234,50")).toBe(123450);
    expect(parseBrlParaCentavos("30")).toBe(3000);
    expect(parseBrlParaCentavos("30,5")).toBe(3050);
  });

  it("rejeita entradas ambiguas, negativas e fora da precisao segura", () => {
    for (const value of ["", "-1", "1,234", "1.23", "R$ abc", "90071992547410"]) {
      expect(parseBrlParaCentavos(value)).toBeNull();
    }
  });
});
