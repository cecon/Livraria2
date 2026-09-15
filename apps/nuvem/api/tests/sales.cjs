const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

test("venda atomica e idempotente com triggers reais", { timeout: 45000 }, async t => {
  assert.equal(process.env.API_TEST_DATABASE, "isolated-local");
  assert.match(process.env.DATABASE_URL ?? "", /@127\.0\.0\.1:55439\/livraria_test/);
  const db = new PrismaClient();
  let child;
  const base = "http://127.0.0.1:3003/api/v1";
  const run = sql => execFileSync("docker", ["exec", "-i", "livraria-separacao-db",
    "psql", "-U", "postgres", "-d", "livraria_test", "-v", "ON_ERROR_STOP=1"],
    { input: sql, stdio: ["pipe", "pipe", "pipe"] });
  const password = randomUUID();
  const operatorUid = randomUUID();
  const bookUid = randomUUID();
  const formUid = randomUUID();
  async function request(route, token, body) {
    const response = await fetch(base + route, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    run(`drop schema public cascade; create schema public;
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      end $$;`);
    const migrations = path.resolve(__dirname, "../../migrations");
    for (const file of fs.readdirSync(migrations).filter(f => f.endsWith(".sql")).sort()) {
      run(fs.readFileSync(path.join(migrations, file), "utf8"));
    }
    for (const file of ["001_protocolo_catalogo.sql", "002_ingestao_vendas.sql"]) {
      run(fs.readFileSync(path.resolve(__dirname, "../sql", file), "utf8"));
    }
    await db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${operatorUid}::uuid,'admin',crypt(${password},gen_salt('bf')),'admin')`;
    await db.$executeRaw`insert into public.livro(sync_uid,codigo,titulo,preco_centavos)
      values(${bookUid}::uuid,'503','Livro vendido',3000)`;
    await db.$executeRaw`insert into public.movimento_estoque(sync_uid,livro_uid,tipo,qtd)
      values(${randomUUID()}::uuid,${bookUid}::uuid,'saldo_inicial',10)`;
    await db.$executeRaw`insert into public.forma_pagamento(sync_uid,chave,rotulo)
      values(${formUid}::uuid,'pix','PIX')`;
    child = spawn(process.execPath, [path.resolve(__dirname, "../dist/main.js")], {
      env: { ...process.env, PORT: "3003", API_OPERATIONS_ENABLED: "true", API_JWT_SECRET: randomUUID() + randomUUID() },
      stdio: "ignore",
    });
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw new Error("API nao iniciou");
      try { if ((await fetch(base + "/health")).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    const adminToken = (await request("/auth/login", null, { usuario: "admin", senha: password })).body.accessToken;
    const mixedCaseToken = (await request("/auth/login", null, { usuario: "  AdMiN  ", senha: password })).body.accessToken;
    assert.ok(mixedCaseToken);
    const profile = await db.$queryRaw`select public.autenticar_perfil('  AdMiN  ', ${password}) as perfil`;
    assert.equal(profile[0].perfil, "admin");
    const uppercaseUid = randomUUID();
    await db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${uppercaseUid}::uuid,'Nova.PESSOA',crypt(${password},gen_salt('bf')),'operador')`;
    assert.equal((await db.usuario.findUnique({ where: { sync_uid: uppercaseUid } })).usuario, "nova.pessoa");
    await assert.rejects(db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${randomUUID()}::uuid,'NOVA.PESSOA',crypt(${password},gen_salt('bf')),'operador')`);
    const firstDevice = (await request("/pdvs", adminToken, { nome: "caixa 1", usuarioUid: operatorUid })).body;
    const secondDevice = (await request("/pdvs", adminToken, { nome: "caixa 2", usuarioUid: operatorUid })).body;
    const sale = {
      pedidoUid: randomUUID(), numero: 6535, cliente: "CLIENTE", turno: "teste", data: "2026-09-14T10:00:00",
      totalCentavos: 6200, operadorUid: operatorUid, turnoUid: null, numeroNoTurno: null, cancelado: false,
      itens: [{ uid: randomUUID(), livroUid: bookUid, codigo: "503", titulo: "Livro vendido", precoCentavos: 3100, quantidade: 2 }],
      pagamentos: [{ uid: randomUUID(), formaUid: formUid, valorCentavos: 6200 }],
    };
    await t.test("preserva preco efetivamente cobrado e baixa estoque uma vez", async () => {
      const response = await request("/sync/vendas", firstDevice.accessToken, sale);
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.estoqueStatus, "incorporada");
      const repeated = await request("/sync/vendas", firstDevice.accessToken, sale);
      assert.deepEqual(repeated, response);
      assert.equal(await db.pedido.count({ where: { sync_uid: sale.pedidoUid } }), 1);
      assert.equal((await db.item_pedido.findUnique({ where: { sync_uid: sale.itens[0].uid } })).preco_centavos, 3100n);
      assert.equal((await db.pagamento_pedido.findUnique({ where: { sync_uid: sale.pagamentos[0].uid } })).valor_centavos, 6200n);
      const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${bookUid}::uuid`;
      assert.equal(balance[0].saldo, 8n);
    });
    await t.test("conteudo alterado, identidade cruzada e total invalido sao negados", async () => {
      assert.equal((await request("/sync/vendas", firstDevice.accessToken, { ...sale, cliente: "OUTRO" })).status, 409);
      assert.equal((await request("/sync/vendas", secondDevice.accessToken, sale)).status, 409);
      assert.equal((await request("/sync/vendas", firstDevice.accessToken, { ...sale, totalCentavos: 6000 })).status, 400);
      assert.equal((await request("/sync/vendas", adminToken, sale)).status, 403);
    });
    await t.test("falha em pagamento desfaz pedido, itens e estoque", async () => {
      const bad = { ...sale, pedidoUid: randomUUID(), numero: 6536,
        itens: [{ ...sale.itens[0], uid: randomUUID() }],
        pagamentos: [{ ...sale.pagamentos[0], uid: randomUUID(), formaUid: randomUUID() }] };
      assert.notEqual((await request("/sync/vendas", firstDevice.accessToken, bad)).status, 201);
      assert.equal(await db.pedido.count({ where: { sync_uid: bad.pedidoUid } }), 0);
      assert.equal(await db.item_pedido.count({ where: { pedido_uid: bad.pedidoUid } }), 0);
      const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${bookUid}::uuid`;
      assert.equal(balance[0].saldo, 8n);
    });
    await t.test("reenvios concorrentes geram um recibo e uma baixa", async () => {
      const another = { ...sale, pedidoUid: randomUUID(), numero: 6539,
        itens: [{ ...sale.itens[0], uid: randomUUID() }],
        pagamentos: [{ ...sale.pagamentos[0], uid: randomUUID() }] };
      const results = await Promise.all([1, 2, 3].map(() => request("/sync/vendas", firstDevice.accessToken, another)));
      assert.ok(results.every(r => r.status === 201));
      assert.deepEqual(results[0].body, results[2].body);
      const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${bookUid}::uuid`;
      assert.equal(balance[0].saldo, 6n);
    });
    await t.test("cancelamento repetido estorna uma vez e pertence ao dispositivo", async () => {
      const route = "/sync/vendas/" + sale.pedidoUid + "/cancelamento";
      assert.equal((await request(route, secondDevice.accessToken, {})).status, 409);
      const response = await request(route, firstDevice.accessToken, {});
      assert.equal(response.status, 201);
      assert.deepEqual(await request(route, firstDevice.accessToken, {}), response);
      const balance = await db.$queryRaw`select saldo from public.vw_saldo_livro where livro_uid=${bookUid}::uuid`;
      assert.equal(balance[0].saldo, 8n);
    });
    if (process.env.API_NATIVE_E2E === "true") {
      await t.test("adapter Rust conecta ao NestJS e confirma catalogo real", async () => {
        execFileSync("cargo", ["test", "--manifest-path", "../../pdv/src-tauri/Cargo.toml",
          "--test", "api_sync_v1", "http_real_nestjs_aplica_catalogo_e_confirma", "--", "--ignored"], {
          stdio: "inherit",
          env: { ...process.env, NUVEM_API_URL: "http://127.0.0.1:3003",
            NUVEM_PDV_UID: firstDevice.uid, NUVEM_PDV_REFRESH_TOKEN: firstDevice.refreshToken,
            NUVEM_TEST_FORMA_UID: formUid },
        });
      });
    }
    await require("./admin-catalog.cjs")(t, db, base, adminToken, firstDevice.accessToken, run);
    await require("./admin-references.cjs")(t, db, base, adminToken, firstDevice.accessToken, run);
    if (process.env.API_WEB_E2E === "true") {
      await require("./web-catalog.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    }
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await db.$disconnect();
  }
});
