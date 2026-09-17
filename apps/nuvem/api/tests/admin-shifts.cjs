const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminShifts(t, db, base, adminToken, deviceToken) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/turnos" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test("escritorio consulta turnos dos PDVs, sem abrir ou fechar", async () => {
    assert.equal((await call("GET", "", undefined, deviceToken)).status, 403);
    const history = await call("GET", "");
    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body));
    assert.equal((await call("POST", "", { sync_uid: randomUUID() })).status, 404);
    assert.equal((await call("POST", `/${randomUUID()}/encerramento`, {})).status, 404);
  });
};
