const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function adminCatalog(t, db, base, adminToken, deviceToken, run) {
  const id = randomUUID();
  const input = { sync_uid: id, codigo: "TEST-503", titulo: "Produto de teste", autor: "Autor",
    preco_centavos: 3100, categoria: 1, descricao: "Teste", estoqueInicial: 7 };
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/livros" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };

  await t.test("catalogo exige admin individual e centavos inteiros", async () => {
    assert.equal((await call("GET", "", null, "invalid")).status, 401);
    assert.equal((await call("POST", "", input, deviceToken)).status, 403);
    const user = randomUUID();
    const password = randomUUID();
    await db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${user}::uuid,${user},crypt(${password},gen_salt('bf')),'operador')`;
    const login = await fetch(base + "/auth/login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuario: user, senha: password }) });
    const operator = await login.json();
    assert.equal((await call("POST", "", input, operator.accessToken)).status, 403);
    for (const price of [-1, 30.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await call("POST", "", { ...input, preco_centavos: price })).status, 400);
    }
    assert.equal(await db.livro.count({ where: { syncUid: id } }), 0);
  });

  await t.test("novo produto e estoque inicial publicados atomicamente", async () => {
    const response = await call("POST", "", input);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const book = await db.livro.findUnique({ where: { syncUid: id } });
    assert.equal(book.precoCentavos, 3100n);
    assert.ok(book.criadoPor);
    const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${id}::uuid`;
    assert.equal(balance[0].saldo, 7n);
    const events = await db.$queryRaw`select produto from public.nuvem_catalogo_evento
      where produto_uid=${id}::uuid order by sequencia desc limit 1`;
    assert.equal(events[0].produto.saldoPublicado, 7);
    assert.equal((await call("POST", "", input)).status, 409);
    assert.equal(await db.movimento_estoque.count({ where: { livro_uid: id } }), 1);
  });

  await t.test("renomear codigo e preco preserva UUID e nao repete saldo inicial", async () => {
    assert.equal((await call("PUT", "/" + id, { ...input, estoqueInicial: 0,
      codigo: "9786585995887", preco_centavos: 4500 })).status, 200);
    const book = await db.livro.findUnique({ where: { syncUid: id } });
    assert.equal(book.codigo, "9786585995887");
    assert.equal(book.precoCentavos, 4500n);
    assert.equal(await db.movimento_estoque.count({ where: { livro_uid: id } }), 1);
    assert.equal((await call("PUT", "/" + id, input)).status, 400);
  });

  await t.test("falha no estoque inicial desfaz produto e diario", async () => {
    const failing = randomUUID();
    run(`create function public.test_reject_initial() returns trigger language plpgsql as $$
      begin raise exception 'test only'; end $$;
      create trigger test_reject_initial before insert on public.movimento_estoque
      for each row when (NEW.livro_uid='${failing}'::uuid) execute function public.test_reject_initial();`);
    try {
      assert.notEqual((await call("POST", "", { ...input, sync_uid: failing, codigo: "TEST-ROLLBACK" })).status, 201);
      assert.equal(await db.livro.count({ where: { syncUid: failing } }), 0);
      const events = await db.$queryRaw`select count(*) as count from public.nuvem_catalogo_evento where produto_uid=${failing}::uuid`;
      assert.equal(events[0].count, 0n);
    } finally { run("drop trigger test_reject_initial on public.movimento_estoque; drop function public.test_reject_initial();"); }
  });

  await t.test("codigo duplicado nao sobrescreve identidade nem publica alteracao parcial", async () => {
    const other = randomUUID();
    assert.equal((await call("POST", "", { ...input, sync_uid: other, codigo: "TEST-DUPLICATE", estoqueInicial: 0 })).status, 201);
    assert.equal((await call("PUT", "/" + id, { ...input, codigo: "TEST-DUPLICATE", estoqueInicial: 0 })).status, 409);
    assert.equal((await db.livro.findUnique({ where: { syncUid: id } })).codigo, "9786585995887");
    assert.equal((await db.livro.findUnique({ where: { syncUid: other } })).codigo, "TEST-DUPLICATE");
  });

  await t.test("exclusao publica tombstone sem apagar referencia historica", async () => {
    assert.equal((await call("DELETE", "/" + id)).status, 200);
    assert.equal((await call("DELETE", "/" + id)).status, 200);
    assert.equal((await db.livro.findUnique({ where: { syncUid: id } })).ativo, false);
    const events = await db.$queryRaw`select operacao from public.nuvem_catalogo_evento
      where produto_uid=${id}::uuid order by sequencia desc limit 1`;
    assert.equal(events[0].operacao, "delete");
    assert.equal((await call("PUT", "/" + id, { ...input, estoqueInicial: 0 })).status, 404);
  });

  await t.test("catalogo pagina por UUID sem cortar em 2000 ou repetir registros", async () => {
    run(`insert into public.livro(sync_uid,codigo,titulo,preco_centavos)
      select gen_random_uuid(), 'PAG-'||i, 'Paginacao '||i, 0 from generate_series(1,501) i;`);
    const first = await call("GET", "");
    assert.equal(first.body.items.length, 500);
    assert.ok(first.body.next);
    const second = await call("GET", "?after=" + first.body.next);
    assert.ok(second.body.items.length > 0);
    assert.equal(second.body.next, null);
    const all = [...first.body.items, ...second.body.items].map(book => book.sync_uid);
    assert.equal(new Set(all).size, all.length);
    assert.ok(!all.includes(id));
    assert.equal((await call("GET", "?after=invalid")).status, 400);
  });
};
