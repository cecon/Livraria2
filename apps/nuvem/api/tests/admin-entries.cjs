const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminEntries(t, db, base, adminToken, deviceToken, run) {
  const firstBook = randomUUID();
  const secondBook = randomUUID();
  const entryUid = randomUUID();
  const firstItem = randomUUID();
  const secondItem = randomUUID();
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/lancamentos" + path, {
      method, headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  await db.livro.createMany({ data: [
    { syncUid: firstBook, codigo: "ENTRY-1", titulo: "Entrada um" },
    { syncUid: secondBook, codigo: "ENTRY-2", titulo: "Entrada dois" },
  ] });

  await t.test("lancamentos exigem admin e validam quantidade e centavos", async () => {
    assert.equal((await call("GET", "", undefined, deviceToken)).status, 403);
    assert.equal((await call("POST", "", { sync_uid: entryUid })).status, 201);
    for (const input of [
      { sync_uid: randomUUID(), livro_uid: firstBook, qtd: 0, custo_unit_centavos: 100 },
      { sync_uid: randomUUID(), livro_uid: firstBook, qtd: 1, custo_unit_centavos: 10.5 },
    ]) assert.equal((await call("POST", `/${entryUid}/itens`, input)).status, 400);
  });

  await t.test("rascunho preserva identidade e calcula total sem float", async () => {
    assert.equal((await call("PUT", `/${entryUid}`, { fornecedor_uid: null, numero: "NF-42" })).status, 200);
    assert.equal((await call("POST", `/${entryUid}/itens`, {
      sync_uid: firstItem, livro_uid: firstBook, qtd: 2, custo_unit_centavos: 3100,
    })).status, 201);
    assert.equal((await call("POST", `/${entryUid}/itens`, {
      sync_uid: secondItem, livro_uid: secondBook, qtd: 1, custo_unit_centavos: 4500,
    })).status, 201);
    const detail = await call("GET", `/${entryUid}`);
    assert.equal(detail.body.numero, "NF-42");
    assert.equal(detail.body.totalCentavos, 10700);
    assert.equal(detail.body.itens.length, 2);
  });

  await t.test("falha ao finalizar desfaz todos os movimentos", async () => {
    run(`create function public.test_reject_entry() returns trigger language plpgsql as $$
      begin if NEW.livro_uid='${secondBook}'::uuid and NEW.tipo='entrada' then
        raise exception 'test only'; end if; return NEW; end $$;
      create trigger test_reject_entry before insert on public.movimento_estoque
      for each row execute function public.test_reject_entry();`);
    try {
      assert.equal((await call("POST", `/${entryUid}/finalizacao`, {})).status, 500);
      assert.equal(await db.movimento_estoque.count({ where: { referencia: { startsWith: `lancamento:${entryUid}:entrada:` } } }), 0);
      assert.equal((await db.lancamento_entrada.findUnique({ where: { sync_uid: entryUid } })).status, "rascunho");
    } finally { run("drop trigger test_reject_entry on public.movimento_estoque; drop function public.test_reject_entry();"); }
  });

  await t.test("finalizacao e cancelamento repetidos nao duplicam estoque", async () => {
    assert.equal((await call("POST", `/${entryUid}/finalizacao`, {})).status, 201);
    assert.equal((await call("POST", `/${entryUid}/finalizacao`, {})).status, 201);
    assert.equal(await db.movimento_estoque.count({ where: { referencia: { startsWith: `lancamento:${entryUid}:entrada:` } } }), 2);
    assert.equal((await call("POST", `/${entryUid}/cancelamento`, {})).status, 201);
    assert.equal((await call("POST", `/${entryUid}/cancelamento`, {})).status, 201);
    assert.equal(await db.movimento_estoque.count({ where: { referencia: { startsWith: `lancamento:${entryUid}:estorno:` } } }), 2);
    const balances = await db.$queryRaw`select saldo from public.vw_saldo_livro
      where livro_uid in (${firstBook}::uuid, ${secondBook}::uuid) order by livro_uid`;
    assert.ok(balances.every(row => row.saldo === 0n));
  });

  await t.test("apenas rascunho pode ser editado ou excluido", async () => {
    assert.equal((await call("DELETE", `/${entryUid}/itens/${firstItem}`)).status, 409);
    assert.equal((await call("DELETE", `/${entryUid}`)).status, 409);
  });
};
