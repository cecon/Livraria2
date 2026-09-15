const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function references(t, db, base, adminToken, deviceToken, run) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body !== undefined && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const supplier = randomUUID();
  const form = randomUUID();
  const system = randomUUID();
  const supplierInput = { sync_uid: supplier, nome: "Fornecedor Referencia", ativo: true };
  const formInput = { sync_uid: form, rotulo: "Pagamento Referencia", ativa: true, ordem: 10 };

  await t.test("referencias exigem administrador individual", async () => {
    for (const resource of ["formas", "fornecedores"]) {
      assert.equal((await call("GET", resource, undefined, "invalid")).status, 401);
      assert.equal((await call("GET", resource, undefined, deviceToken)).status, 403);
    }
  });

  await t.test("fornecedor normalizado evita duplicidade e preserva identidade", async () => {
    assert.equal((await call("POST", "fornecedores", supplierInput)).status, 201);
    assert.equal((await call("POST", "fornecedores", { ...supplierInput,
      sync_uid: randomUUID(), nome: "  FORNECEDOR   REFERENCIA  " })).status, 409);
    assert.equal((await call("PUT", "fornecedores/" + supplier,
      { ...supplierInput, nome: "Nome atualizado", telefone: "123" })).status, 200);
    const saved = await db.fornecedor.findUnique({ where: { sync_uid: supplier } });
    assert.equal(saved.nome_norm, "nome atualizado");
    assert.ok(saved.criado_por);
    assert.ok(saved.sincronizado_em);
    assert.equal((await call("PUT", "fornecedores/" + supplier, { ...supplierInput, ativo: "true" })).status, 400);
    assert.equal((await call("GET", "fornecedores?after=invalid")).status, 400);
  });

  await t.test("exclusao de fornecedor e idempotente e nao permite ressuscitar", async () => {
    assert.equal((await call("DELETE", "fornecedores/" + supplier)).status, 200);
    assert.equal((await call("DELETE", "fornecedores/" + supplier)).status, 200);
    assert.equal((await call("PUT", "fornecedores/" + supplier, supplierInput)).status, 404);
    const saved = await db.fornecedor.findUnique({ where: { sync_uid: supplier } });
    assert.ok(saved.excluido_em);
    assert.equal(saved.ativo, false);
    assert.ok(!(await call("GET", "fornecedores")).body.items.some(row => row.sync_uid === supplier));
  });

  await t.test("chave e classificacao de formas sao imutaveis", async () => {
    assert.equal((await call("POST", "formas", formInput)).status, 201);
    assert.equal((await call("POST", "formas", { ...formInput, sync_uid: randomUUID() })).status, 409);
    assert.equal((await call("POST", "formas", { ...formInput, sync_uid: randomUUID(), de_sistema: true })).status, 403);
    assert.equal((await call("PUT", "formas/" + form, { ...formInput, chave: "outra" })).status, 400);
    assert.equal((await call("PUT", "formas/" + form, { ...formInput, de_sistema: true })).status, 400);
    await db.forma_pagamento.create({ data: { sync_uid: system, chave: "referencia_sistema",
      rotulo: "Sistema", de_sistema: true, ordem: 20 } });
    assert.equal((await call("PUT", "formas/" + system,
      { rotulo: "Sistema renomeado", ativa: true, ordem: 20 })).status, 200);
    assert.equal((await call("PUT", "formas/" + system + "/ativa", { ativa: false })).status, 403);
    assert.equal((await call("DELETE", "formas/" + system)).status, 403);
    assert.equal((await call("PUT", "formas/" + system,
      { rotulo: "Sistema", ativa: false, ordem: 20 })).status, 403);
  });

  await t.test("reordenacao valida lista completa e desfaz falha parcial", async () => {
    const current = (await call("GET", "formas")).body.items;
    const ids = current.map(row => row.sync_uid).reverse();
    assert.equal((await call("PUT", "formas/reordenar", { uids: [form, form] })).status, 400);
    assert.equal((await call("PUT", "formas/reordenar", { uids: [form] })).status, 409);
    assert.equal((await call("PUT", "formas/reordenar", { uids: ids })).status, 200);
    const before = await db.forma_pagamento.findMany({ orderBy: { sync_uid: "asc" } });
    const failing = ids[ids.length - 1];
    run(`create function public.test_reject_order() returns trigger language plpgsql as $$
      begin raise exception 'test only'; end $$;
      create trigger test_reject_order before update on public.forma_pagamento
      for each row when (NEW.sync_uid='${failing}'::uuid) execute function public.test_reject_order();`);
    try {
      assert.equal((await call("PUT", "formas/reordenar", { uids: ids })).status, 500);
      const after = await db.forma_pagamento.findMany({ orderBy: { sync_uid: "asc" } });
      assert.deepEqual(after, before);
    } finally { run("drop trigger test_reject_order on public.forma_pagamento; drop function public.test_reject_order();"); }
    for (const [index, id] of ids.entries()) {
      assert.equal(before.find(row => row.sync_uid === id).ordem, index);
    }
  });

  await t.test("forma comum pode ser desativada e excluida sem apagar historico", async () => {
    assert.equal((await call("PUT", "formas/" + form + "/ativa", { ativa: false })).status, 200);
    assert.equal((await call("DELETE", "formas/" + form)).status, 200);
    assert.equal((await call("DELETE", "formas/" + form)).status, 200);
    assert.equal((await call("PUT", "formas/" + form, formInput)).status, 404);
    assert.equal((await call("PUT", "formas/" + form + "/ativa", { ativa: true })).status, 404);
    assert.ok((await db.forma_pagamento.findUnique({ where: { sync_uid: form } })).excluido_em);
  });
};
