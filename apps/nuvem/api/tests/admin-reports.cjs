const assert = require("node:assert/strict");
const { Workbook } = require("exceljs");

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
  await t.test("exportacao de estoque gera PDF e XLSX autenticados", async () => {
    const path = base + "/admin/relatorios/estoque/";
    const get = (format, token) => fetch(path + format, {
      headers: { authorization: "Bearer " + token },
    });
    assert.equal((await get("pdf", deviceToken)).status, 403);
    assert.equal((await get("xlsx", "invalid")).status, 401);
    const pdf = await get("pdf", adminToken);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type"), /application\/pdf/);
    assert.match(pdf.headers.get("content-disposition"), /attachment; filename="estoque-.*\.pdf"/);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const xlsx = await get("xlsx", adminToken);
    assert.equal(xlsx.status, 200);
    assert.match(xlsx.headers.get("content-type"), /spreadsheetml\.sheet/);
    const bytes = Buffer.from(await xlsx.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet("Estoque");
    assert.equal(sheet.getRow(4).getCell(1).value, "Código");
    const stock = await call("/estoque");
    assert.equal(sheet.rowCount, stock.body.itens.length + 4);
  });
};
