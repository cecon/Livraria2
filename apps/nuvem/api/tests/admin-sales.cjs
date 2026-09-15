const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminSales(t, db, base, adminToken, deviceToken) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/vendas" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const user = await db.usuario.findFirst({ where: { usuario: "admin" } });
  const shiftUid = randomUUID();
  await db.turno_operacao.create({ data: { sync_uid: shiftUid, operador_uid: user.sync_uid,
    caixa_inicial_centavos: 0n, status: "aberto", abertura: new Date().toISOString(), origem: "escritorio" } });
  const bookUid = randomUUID();
  await db.livro.create({ data: { syncUid: bookUid, codigo: "SALE-31", titulo: "Venda por 31",
    precoCentavos: 3000n } });
  await db.movimento_estoque.create({ data: { sync_uid: randomUUID(), livro_uid: bookUid,
    tipo: "saldo_inicial", qtd: 10n } });
  const cash = await db.forma_pagamento.upsert({ where: { chave: "dinheiro" }, update: {
    ativa: true, excluido_em: null }, create: { sync_uid: randomUUID(), chave: "dinheiro",
    rotulo: "Dinheiro", de_sistema: true } });
  const sale = { pedidoUid: randomUUID(), turnoUid: shiftUid, cliente: "CLIENTE",
    itens: [{ uid: randomUUID(), livroUid: bookUid, codigo: "SALE-31", titulo: "Venda por 31",
      precoCentavos: 3100, quantidade: 2 }],
    pagamentos: [{ uid: randomUUID(), formaUid: cash.sync_uid, valorCentavos: 6500 }] };

  await t.test("venda administrativa exige admin e turno proprio aberto", async () => {
    assert.equal((await call("POST", "", sale, deviceToken)).status, 403);
    assert.equal((await call("POST", "", { ...sale, turnoUid: randomUUID() })).status, 404);
  });
  await t.test("venda e atomica preserva preco cobrado e calcula troco", async () => {
    const response = await call("POST", "", sale);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.totalCentavos, 6200);
    assert.equal(response.body.trocoCentavos, 300);
    assert.equal((await db.item_pedido.findUnique({ where: { sync_uid: sale.itens[0].uid } })).preco_centavos, 3100n);
    assert.equal((await db.pedido.findUnique({ where: { sync_uid: sale.pedidoUid } })).estoque_status, "incorporada");
    const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${bookUid}::uuid`;
    assert.equal(balance[0].saldo, 8n);
    assert.equal((await call("POST", "", sale)).status, 409);
    const today = await call("GET", "/hoje");
    assert.ok(today.body.some(item => item.sync_uid === sale.pedidoUid && item.totalCentavos === 6200));
  });
};
