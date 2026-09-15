const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminStock(t, db, base, adminToken, deviceToken) {
  const bookUid = randomUUID();
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/estoque" + path, {
      method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };

  await db.livro.create({ data: { syncUid: bookUid, codigo: "STOCK-TEST", titulo: "Estoque teste" } });
  await db.movimento_estoque.create({ data: {
    sync_uid: randomUUID(), livro_uid: bookUid, tipo: "saldo_inicial", qtd: 5n,
    custo_unit_centavos: 3100n, criado_em: new Date().toISOString(),
  } });

  await t.test("estoque exige administrador e devolve inteiros seguros", async () => {
    assert.equal((await call("GET", "/saldos", undefined, deviceToken)).status, 403);
    const response = await call("GET", "/saldos");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.find(item => item.livro_uid === bookUid), { livro_uid: bookUid, saldo: 5 });
    for (const qtd of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await call("POST", "/ajustes", {
        sync_uid: randomUUID(), livro_uid: bookUid, qtd, motivo: "teste",
      })).status, 400);
    }
  });

  await t.test("ajuste e extrato preservam quantidade e custo em centavos", async () => {
    const movementUid = randomUUID();
    assert.equal((await call("POST", "/ajustes", {
      sync_uid: movementUid, livro_uid: bookUid, qtd: 3, motivo: "Conferencia",
    })).status, 201);
    const extract = await call("GET", `/livros/${bookUid}/movimentos`);
    assert.equal(extract.status, 200);
    assert.equal(extract.body.length, 2);
    assert.equal(extract.body[0].custo_unit_centavos, 3100);
    assert.equal(extract.body[1].qtd, 3);
    assert.equal(extract.body[1].motivo, "Conferencia");
  });

  await t.test("contagem e atomica e repeticao do mesmo lote e idempotente", async () => {
    const first = randomUUID();
    const body = { itens: [{ sync_uid: first, livro_uid: bookUid, qtd: -2 }] };
    assert.deepEqual((await call("POST", "/contagens", body)).body, { ajustes: 1 });
    assert.deepEqual((await call("POST", "/contagens", body)).body, { ajustes: 1 });
    assert.equal(await db.movimento_estoque.count({ where: { sync_uid: first } }), 1);

    const valid = randomUUID();
    const failed = await call("POST", "/contagens", { itens: [
      { sync_uid: valid, livro_uid: bookUid, qtd: 1 },
      { sync_uid: randomUUID(), livro_uid: randomUUID(), qtd: 1 },
    ] });
    assert.equal(failed.status, 404);
    assert.equal(await db.movimento_estoque.count({ where: { sync_uid: valid } }), 0);
  });

  await t.test("divergencia aberta registra decisao e autor", async () => {
    const divergenceUid = randomUUID();
    await db.divergencia_estoque.create({ data: {
      sync_uid: divergenceUid, livro_uid: bookUid, tipo: "saldo_negativo",
      descricao: "Saldo abaixo de zero", saldo_antes: 1n, qtd_evento: -2n,
    } });
    const listed = await call("GET", "/divergencias");
    assert.equal(listed.body[0].sync_uid, divergenceUid);
    assert.equal(listed.body[0].qtd_evento, -2);
    assert.equal((await call("PUT", `/divergencias/${divergenceUid}`, { status: "resolvida" })).status, 200);
    const saved = await db.divergencia_estoque.findUnique({ where: { sync_uid: divergenceUid } });
    assert.equal(saved.status, "resolvida");
    assert.ok(saved.resolvida_por);
    assert.ok(saved.resolvida_em);
    assert.equal((await call("PUT", `/divergencias/${divergenceUid}`, { status: "ignorada" })).status, 409);
  });
};
