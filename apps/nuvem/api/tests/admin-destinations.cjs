const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function destinations(t, db, base, adminToken, deviceToken) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/destinacoes" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const id = randomUUID();
  const input = { sync_uid: id, nome: "Destino Teste", ativa: true, ordem: 10 };

  await t.test("destinacoes exigem admin e protegem registros de sistema", async () => {
    assert.equal((await call("GET", "", undefined, deviceToken)).status, 403);
    assert.equal((await call("POST", "", input)).status, 201);
    assert.equal((await call("POST", "", { ...input, sync_uid: randomUUID(), nome: " DESTINO TESTE " })).status, 409);
    const system = await db.destinacao.create({ data: { sync_uid: randomUUID(), nome: "Loja",
      nome_norm: "loja", de_sistema: true, ativa: true, ordem: 0 } });
    assert.equal((await call("PUT", `/${system.sync_uid}/ativa`, { ativa: false })).status, 403);
    assert.equal((await call("DELETE", `/${system.sync_uid}`)).status, 403);
  });

  await t.test("reordenacao usa apenas destinos livres e exclusao e idempotente", async () => {
    const items = (await call("GET", "")).body.items;
    const free = items.filter(item => !item.de_sistema).map(item => item.sync_uid).reverse();
    assert.equal((await call("PUT", "/reordenar", { uids: free })).status, 200);
    assert.equal((await call("PUT", "/reordenar", { uids: [] })).status, 409);
    assert.equal((await call("DELETE", `/${id}`)).status, 200);
    assert.equal((await call("DELETE", `/${id}`)).status, 200);
    assert.equal((await call("PUT", `/${id}`, input)).status, 404);
  });
};
