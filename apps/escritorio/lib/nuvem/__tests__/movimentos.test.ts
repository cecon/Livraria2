import { describe, expect, it } from "vitest";
import { lerQtdAjuste, mensagemAjuste, traduzirErroAjuste } from "../ajuste_erro";

describe("ajuste manual de estoque (014)", () => {
  it("lê só quantidade inteira com sinal", () => {
    expect(lerQtdAjuste("-2")).toBe(-2);
    expect(lerQtdAjuste(" +3 ")).toBe(3);
    expect(lerQtdAjuste("4")).toBe(4);
    expect(lerQtdAjuste("2,5")).toBeNull();
    expect(lerQtdAjuste("-2abc")).toBeNull();
    expect(lerQtdAjuste("")).toBeNull();
  });

  it("traduz os códigos do domínio", () => {
    expect(mensagemAjuste("AJUSTE_SEM_QUANTIDADE")).toBe("Informe a quantidade (ex.: -2 ou 3)");
    expect(mensagemAjuste("MOTIVO_OBRIGATORIO")).toBe("Motivo é obrigatório");
    expect(mensagemAjuste("ESTOQUE_NEGATIVO", 1)).toBe("O estoque ficaria negativo (atual: 1)");
  });

  it("traduz a recusa da nuvem com o saldo oficial", () => {
    expect(traduzirErroAjuste({ message: "ESTOQUE_NEGATIVO", details: "3" })).toEqual({
      error: "O estoque ficaria negativo (atual: 3)",
      saldoAtual: 3,
    });
  });

  it("mantém a mensagem de outros erros, sem saldo", () => {
    expect(traduzirErroAjuste({ message: "permission denied", details: null })).toEqual({
      error: "permission denied",
    });
  });
});
