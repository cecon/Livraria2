import { describe, it, expect } from "vitest";
import {
  PAG_VAZIO,
  paraCentavos,
  pagamentosParaPayload,
  parseRascunho,
  somaPagamentos,
  type Pagamentos,
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
  it("produz lista esparsa por formaId com valores inteiros", () => {
    // formas do cadastro: 1=Crédito, 2=Débito, 3=Dinheiro (ids dinâmicos).
    const pag: Pagamentos = { 1: 4500, 2: 0, 3: 1000 };
    expect(pagamentosParaPayload(pag)).toEqual([
      { formaId: 1, valorCentavos: 4500 },
      { formaId: 3, valorCentavos: 1000 },
    ]);
  });

  it("força todo valor a inteiro (nunca manda string ao backend)", () => {
    // Causa raiz histórica: string "4500" cruzando a fronteira Tauri quebrava
    // com `invalid type: string "4500", expected i64`.
    const sujo = { 1: "4500", 3: "x", 4: 999.9 } as unknown as Pagamentos;
    const payload = pagamentosParaPayload(sujo);
    expect(payload).toEqual([
      { formaId: 1, valorCentavos: 4500 },
      { formaId: 4, valorCentavos: 999 },
    ]);
    for (const r of payload) {
      expect(Number.isInteger(r.valorCentavos)).toBe(true);
      expect(Number.isInteger(r.formaId)).toBe(true);
    }
  });
});

describe("somaPagamentos", () => {
  it("soma coagindo a inteiro", () => {
    expect(somaPagamentos({ 1: 4500, 3: 1000 })).toBe(5500);
    expect(somaPagamentos({ 1: "4500", 3: "x" } as unknown as Pagamentos)).toBe(4500);
    expect(somaPagamentos({})).toBe(0);
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
    // Rascunho salvo por versão antiga com pagamento por chaves fixas.
    const antigo = JSON.stringify({
      cliente: "CLIENTE",
      itens: [],
      pag: { cartao: "4500", dinheiro: "x", pix: 999 },
    });
    const r = parseRascunho(antigo);
    expect(r?.pag).toEqual({});
  });

  it("tolera itens ausentes ou inválidos", () => {
    const r = parseRascunho(JSON.stringify({ cliente: "X" }));
    expect(r?.itens).toEqual([]);
    expect(r?.cliente).toBe("X");
  });
});
