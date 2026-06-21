import { describe, it, expect } from "vitest";
import {
  PAG_VAZIO,
  paraCentavos,
  pagamentosParaPayload,
  parseRascunho,
} from "./venda";

describe("paraCentavos", () => {
  it("mantém inteiro", () => {
    expect(paraCentavos(4500)).toBe(4500);
  });

  it("converte string de dígitos (bug do rascunho antigo)", () => {
    // Regressão: a maquininha já guardava centavos como string "4500".
    expect(paraCentavos("4500")).toBe(4500);
  });

  it("trunca decimais", () => {
    expect(paraCentavos(45.9)).toBe(45);
  });

  it("vira 0 para valores inválidos", () => {
    expect(paraCentavos("")).toBe(0);
    expect(paraCentavos("abc")).toBe(0);
    expect(paraCentavos("45,00")).toBe(0); // vírgula -> NaN -> 0
    expect(paraCentavos(null)).toBe(0);
    expect(paraCentavos(undefined)).toBe(0);
    expect(paraCentavos(NaN)).toBe(0);
  });
});

describe("pagamentosParaPayload", () => {
  it("força todo valor a inteiro (nunca manda string ao backend)", () => {
    // Esta é a causa raiz: string "4500" cruzando a fronteira Tauri quebrava
    // com `invalid type: string "4500", expected i64`.
    const sujo = {
      cartao: "4500",
      dinheiro: 0,
      pix: 1000,
      ministerio: 0,
      vale: 0,
    } as unknown as typeof PAG_VAZIO;
    const payload = pagamentosParaPayload(sujo);
    expect(payload).toEqual({
      cartao: 4500,
      dinheiro: 0,
      pix: 1000,
      ministerio: 0,
      vale: 0,
    });
    for (const v of Object.values(payload)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("parseRascunho", () => {
  it("retorna null para vazio ou JSON inválido", () => {
    expect(parseRascunho(null)).toBeNull();
    expect(parseRascunho("")).toBeNull();
    expect(parseRascunho("{ não é json")).toBeNull();
  });

  it("restaura cliente e itens", () => {
    const itens = [
      { codigo: "1", titulo: "Livro", precoCentavos: 4500, qtd: 2 },
    ];
    const r = parseRascunho(JSON.stringify({ cliente: "MARIA", itens, pag: PAG_VAZIO }));
    expect(r?.cliente).toBe("MARIA");
    expect(r?.itens).toEqual(itens);
  });

  it("NUNCA restaura pagamento antigo — sempre zera (regressão)", () => {
    // Rascunho salvo por versão antiga com pagamento string/garbage.
    const antigo = JSON.stringify({
      cliente: "CLIENTE",
      itens: [],
      pag: { cartao: "4500", dinheiro: "x", pix: 999, ministerio: 0, vale: 0 },
    });
    const r = parseRascunho(antigo);
    expect(r?.pag).toEqual(PAG_VAZIO);
  });

  it("tolera itens ausentes ou inválidos", () => {
    const r = parseRascunho(JSON.stringify({ cliente: "X" }));
    expect(r?.itens).toEqual([]);
    expect(r?.cliente).toBe("X");
  });
});
