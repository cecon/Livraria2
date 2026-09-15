const assert = require("node:assert/strict");

module.exports = async function adminReports(t, base, adminToken, deviceToken) {
  const call = async (path, token = adminToken) => {
    const response = await fetch(base + "/admin/relatorios" + path,
      { headers: { authorization: "Bearer " + token } });
    return { status: response.status, body: await response.json() };
  };
  await t.test("relatorios exigem admin e validam filtros", async () => {
    assert.equal((await call("/estoque", deviceToken)).status, 403);
    assert.equal((await call("/vendas?data=invalida&periodo=dia")).status, 400);
    assert.equal((await call("/dashboard?periodo=qualquer")).status, 400);
  });
  await t.test("relatorios devolvem apenas inteiros do contrato", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const stock = await call("/estoque");
    assert.equal(stock.status, 200);
    assert.ok(Number.isSafeInteger(stock.body.valorTotalCentavos));
    const sales = await call(`/vendas?data=${today}&periodo=dia`);
    assert.equal(sales.status, 200);
    assert.ok(sales.body.pedidos.every(order => Number.isSafeInteger(order.totalCentavos)));
    assert.equal((await call(`/destinacoes?inicio=${today}&fim=${today}`)).status, 200);
    const dashboard = await call("/dashboard?periodo=hoje");
    assert.equal(dashboard.status, 200);
    assert.ok(Number.isSafeInteger(dashboard.body.vendasCentavos));
  });
};
