const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminSales(t, db, base, adminToken, deviceToken) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/vendas" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test("escritorio consulta vendas dos PDVs, sem registrar novas", async () => {
    assert.equal((await call("POST", "", { pedidoUid: randomUUID() })).status, 404);
    assert.equal((await call("GET", "/hoje", undefined, deviceToken)).status, 403);
    const today = await call("GET", "/hoje");
    assert.equal(today.status, 200);
    assert.ok(Array.isArray(today.body));
  });
};
