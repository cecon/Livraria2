import { describe, expect, it } from "vitest";
import { montarItensRelatorioEstoque } from "../relatorios_estoque";

describe("relatorioEstoque", () => {
  it("usa saldo oficial da nuvem e preserva saldo negativo", () => {
    const itens = montarItensRelatorioEstoque(
      [{ sync_uid: "l-1", codigo: "1", titulo: "Livro", categoria: 0, preco_centavos: 1500 }],
      new Map([["l-1", -2]]),
    );

    expect(itens).toEqual([
      { codigo: "1", titulo: "Livro", categoria: 0, precoCentavos: 1500, estoque: -2, valorCentavos: -3000 },
    ]);
  });
});
