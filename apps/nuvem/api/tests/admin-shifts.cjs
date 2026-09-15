const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminShifts(t, db, base, adminToken, deviceToken) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/turnos" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test("turno exige admin e so permite um aberto", async () => {
    assert.equal((await call("GET", "", undefined, deviceToken)).status, 403);
    const opened = await call("POST", "", { sync_uid: randomUUID(), caixa_inicial_centavos: 1000 });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    assert.equal(opened.body.caixaInicialCentavos, 1000);
    assert.equal((await call("POST", "", { sync_uid: randomUUID(), caixa_inicial_centavos: 0 })).status, 409);
    const current = await call("GET", "/aberto");
    assert.equal(current.body.sync_uid, opened.body.sync_uid);

    const cash = await db.forma_pagamento.upsert({ where: { chave: "dinheiro" },
      update: { ativa: true, excluido_em: null }, create: { sync_uid: randomUUID(),
        chave: "dinheiro", rotulo: "Dinheiro", de_sistema: true } });
    const saleUid = randomUUID();
    await db.pedido.create({ data: { sync_uid: saleUid, numero: 99999n, cliente: "CLIENTE",
      turno: "manha", data: new Date().toISOString().slice(0, 10), total_centavos: 2500n,
      turno_uid: opened.body.sync_uid, operador_uid: opened.body.operadorUid, estoque_status: "incorporada" } });
    await db.pagamento_pedido.create({ data: { sync_uid: randomUUID(), pedido_uid: saleUid,
      forma_uid: cash.sync_uid, valor_centavos: 2500n } });
    const summary = await call("GET", `/${opened.body.sync_uid}/resumo`);
    assert.equal(summary.body.qtdVendas, 1);
    assert.equal(summary.body.esperadoDinheiroCentavos, 3500);
    const closed = await call("POST", `/${opened.body.sync_uid}/encerramento`, { conferido_centavos: 3400 });
    assert.equal(closed.status, 201);
    assert.equal(closed.body.diferencaCentavos, -100);
    assert.equal((await call("POST", `/${opened.body.sync_uid}/encerramento`, { conferido_centavos: 3400 })).status, 201);
  });
};
