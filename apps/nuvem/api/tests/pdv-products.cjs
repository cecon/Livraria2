const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async (t, db, base, admin, device) => {
  const post = async (body, token = admin) => {
    const r = await fetch(base + "/produtos-pdv", { method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  await t.test("produtos do PDV: autorização, gravação atômica, contagem e concorrência", async () => {
    const uid = randomUUID();
    const create = { operacao: randomUUID(), uid, acao: "criar",
      dados: { codigo: "PDV-" + uid, titulo: "Produto de teste", autor: "", descricao: "",
        categoria: 0, preco_centavos: 1290, estoqueInicial: 5 } };
    assert.equal((await post(create, device)).status, 403);
    const created = await post(create);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.saldoPublicado, 5);
    assert.equal(created.body.ativo, true);
    assert.deepEqual(await post(create), created);
    assert.equal(await db.movimento_estoque.count({ where: { livro_uid: uid } }), 1);
    const badRetry = await post({ ...create, dados: { ...create.dados, titulo: "Outro" } });
    assert.equal(badRetry.status, 409);
    assert.equal((await post({ ...create, operacao: randomUUID(), uid: randomUUID() })).status, 409);
    const exact = await fetch(base + "/produtos-pdv/codigo?codigo=" + encodeURIComponent(create.dados.codigo),
      { headers: { authorization: "Bearer " + device } });
    assert.equal(exact.status, 200);
    assert.equal((await exact.json()).produto.uid, uid);
    const absent = await fetch(base + "/produtos-pdv/codigo?codigo=ausente-" + uid,
      { headers: { authorization: "Bearer " + device } });
    assert.deepEqual(await absent.json(), { produto: null });
    const count = { operacao: randomUUID(), uid, acao: "contar", versao: created.body.versao, quantidade: 2 };
    const counted = await post(count);
    assert.equal(counted.status, 201, JSON.stringify(counted.body));
    assert.equal(counted.body.saldoPublicado, 2);
    assert.deepEqual(await post(count), counted);
    const movements = await db.movimento_estoque.findMany({ where: { livro_uid: uid, tipo: "contagem" } });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].qtd, -3n);
    assert.equal((await post({ ...count, operacao: randomUUID(), quantidade: 10 })).status, 409);
    const unchanged = { ...count, operacao: randomUUID(), versao: counted.body.versao };
    assert.equal((await post(unchanged)).status, 201);
    assert.equal(await db.movimento_estoque.count({ where: { livro_uid: uid } }), 2);
    const audit = await db.$queryRaw`select count(*)::int as n from public.nuvem_produto_operacao where uid=${unchanged.operacao}::uuid`;
    assert.equal(audit[0].n, 1);
    const results = await Promise.all([7, 8].map(quantidade => post({ ...count,
      operacao: randomUUID(), versao: counted.body.versao, quantidade })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const latest = results.find(r => r.status === 201).body;
    const edited = await post({ operacao: randomUUID(), uid, acao: "editar", versao: latest.versao,
      dados: { ...create.dados, estoqueInicial: 0, titulo: "Título editado", preco_centavos: 1590, ativo: true } });
    assert.equal(edited.status, 201, JSON.stringify(edited.body));
    assert.equal(edited.body.precoCentavos, 1590);
    const inactive = await post({ ...create, operacao: randomUUID(), uid: randomUUID(),
      dados: { ...create.dados, codigo: "ZERO-" + uid, estoqueInicial: 0 } });
    assert.equal(inactive.status, 201);
    assert.equal(inactive.body.ativo, false);
    assert.equal((await post({ ...count, operacao: randomUUID(), quantidade: -1 })).status, 400);
    // Replay never sends an obsolete snapshot back to the PDV after newer operations.
    assert.equal((await post(create)).body.titulo, "Título editado");
  });
};
