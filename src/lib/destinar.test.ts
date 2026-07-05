// Testes da lógica da tela "Destinar estoque" (T039 — US1/US4 na parte pura).

import { describe, expect, it } from "vitest";
import {
  LIVRE,
  opcoesDestino,
  opcoesOrigem,
  paraPayload,
  validarTransferenciaUi,
} from "./destinar";
import type { Destinacao, SaldoLivro } from "./types";

const saldos: SaldoLivro = {
  estoque: 80,
  livre: 30,
  carimbos: [
    { destinacaoId: 1, nome: "Loja", qtd: 10 },
    { destinacaoId: 2, nome: "Missões", qtd: 40 },
  ],
};

const ativas: Destinacao[] = [
  { id: 1, nome: "Loja", deSistema: true, ativa: true, ordem: 0 },
  { id: 2, nome: "Missões", deSistema: false, ativa: true, ordem: 1 },
];

describe("opcoesOrigem", () => {
  it("Livre primeiro (com saldo) e carimbos na ordem de baixa", () => {
    const ops = opcoesOrigem(saldos);
    expect(ops.map((o) => o.rotulo)).toEqual([
      "Livre (30)",
      "Loja (10)",
      "Missões (40)",
    ]);
  });

  it("sem saldos carregados mostra Livre (0)", () => {
    expect(opcoesOrigem(null)).toEqual([{ valor: LIVRE, rotulo: "Livre (0)" }]);
  });
});

describe("opcoesDestino", () => {
  it("inclui a Loja (carimbo Loja dá prioridade de venda) e exclui a origem", () => {
    const ops = opcoesDestino(ativas, LIVRE);
    expect(ops.map((o) => o.rotulo)).toEqual(["Loja", "Missões"]);
  });

  it("origem carimbada permite voltar para Livre", () => {
    const ops = opcoesDestino(ativas, "2");
    expect(ops.map((o) => o.rotulo)).toEqual(["Livre", "Loja"]);
  });
});

describe("validarTransferenciaUi", () => {
  it("exige quantidade positiva e destino", () => {
    expect(validarTransferenciaUi("", "2")).toMatch(/quantidade/);
    expect(validarTransferenciaUi("0", "2")).toMatch(/quantidade/);
    expect(validarTransferenciaUi("-3", "2")).toMatch(/quantidade/);
    expect(validarTransferenciaUi("abc", "2")).toMatch(/quantidade/);
    expect(validarTransferenciaUi("5", "")).toMatch(/destino/);
    expect(validarTransferenciaUi("5", "2")).toBeNull();
  });
});

describe("paraPayload", () => {
  it("Livre vira null; ids viram número", () => {
    expect(paraPayload(LIVRE)).toBeNull();
    expect(paraPayload("7")).toBe(7);
  });
});
