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
    assert.deepEqual(response.body.find(item => item.livro_uid === bookUid), { livro_uid: bookUid, codigo: "STOCK-TEST", titulo: "Estoque teste", saldo: 5 });
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

  await t.test("ajuste negativo nao deixa saldo negativo; positivo e reenvio sempre passam", async () => {
    const livro = randomUUID();
    await db.livro.create({ data: { syncUid: livro, codigo: "STOCK-NEG", titulo: "Estoque negativo" } });
    await db.movimento_estoque.create({ data: {
      sync_uid: randomUUID(), livro_uid: livro, tipo: "saldo_inicial", qtd: 1n, criado_em: new Date().toISOString(),
    } });
    const ajuste = (qtd, sync_uid = randomUUID()) =>
      call("POST", "/ajustes", { sync_uid, livro_uid: livro, qtd, motivo: "teste 015" });
    const saldo = async () => (await call("GET", "/saldos")).body.find(item => item.livro_uid === livro).saldo;

    const recusado = await ajuste(-3);
    assert.equal(recusado.status, 409);
    assert.equal(recusado.body.message, "O estoque ficaria negativo (atual: 1)");
    assert.equal(await saldo(), 1);

    const zera = randomUUID();
    assert.equal((await ajuste(-1, zera)).status, 201);
    assert.equal(await saldo(), 0);
    assert.equal((await ajuste(-1, zera)).status, 201); // reenvio idempotente, sem nova checagem
    assert.equal(await saldo(), 0);

    await db.movimento_estoque.create({ data: {
      sync_uid: randomUUID(), livro_uid: livro, tipo: "saida_venda", qtd: -2n, criado_em: new Date().toISOString(),
    } });
    assert.equal((await ajuste(1)).status, 201); // correcao positiva com saldo negativo por venda
    assert.equal(await saldo(), -1);
  });

  await t.test("antiga fila de divergencias nao e exposta", async () => {
    assert.equal((await call("GET", "/divergencias")).status, 404);
    assert.equal((await call("PUT", `/divergencias/${randomUUID()}`, { status: "resolvida" })).status, 404);
  });
};
