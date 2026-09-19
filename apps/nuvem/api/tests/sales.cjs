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
      create schema if not exists extensions;
      create extension if not exists pgcrypto with schema extensions;
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      end $$;`);
    const migrations = path.resolve(__dirname, "../../migrations");
    for (const file of fs.readdirSync(migrations).filter(f => f.endsWith(".sql")).sort()) {
      run(fs.readFileSync(path.join(migrations, file), "utf8"));
    }
    const apiMigrations = path.resolve(__dirname, "../sql");
    for (const file of fs.readdirSync(apiMigrations).filter(f => f.endsWith(".sql")).sort()) {
      run(fs.readFileSync(path.join(apiMigrations, file), "utf8"));
    }
    await db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${operatorUid}::uuid,'admin',extensions.crypt(${password},extensions.gen_salt('bf')),'admin')`;
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
      values(${uppercaseUid}::uuid,'Nova.PESSOA',extensions.crypt(${password},extensions.gen_salt('bf')),'operador')`;
    assert.equal((await db.usuario.findUnique({ where: { sync_uid: uppercaseUid } })).usuario, "nova.pessoa");
    await assert.rejects(db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${randomUUID()}::uuid,'NOVA.PESSOA',extensions.crypt(${password},extensions.gen_salt('bf')),'operador')`);
    const firstDevice = (await request("/pdvs", adminToken, { nome: "caixa 1", usuarioUid: operatorUid })).body;
    const secondDevice = (await request("/pdvs", adminToken, { nome: "caixa 2", usuarioUid: operatorUid })).body;
    const shiftUid = randomUUID();
    const opening = { turnoUid: shiftUid, operadorUid: operatorUid,
      caixaInicialCentavos: 0, abertura: "2026-09-14T09:00:00" };
    const opened = await request("/sync/turnos", firstDevice.accessToken, opening);
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    assert.deepEqual(await request("/sync/turnos", firstDevice.accessToken, opening), opened);
    assert.equal((await request("/sync/turnos", firstDevice.accessToken,
      { ...opening, turnoUid: randomUUID() })).status, 409);
    assert.equal((await request("/sync/turnos", secondDevice.accessToken, opening)).status, 409);
    const otherShiftUid = randomUUID();
    assert.equal((await request("/sync/turnos", secondDevice.accessToken,
      { ...opening, turnoUid: otherShiftUid })).status, 201);
    await t.test("sangria e suprimento pertencem ao turno e toleram reenvio", async () => {
      const movement = { movimentoUid: randomUUID(), turnoUid: shiftUid, operadorUid: operatorUid,
        tipo: "suprimento", valorCentavos: 500, motivo: "troco", criadoEm: "2026-09-14T09:10:00" };
      const received = await request("/sync/caixa-movimentos", firstDevice.accessToken, movement);
      assert.equal(received.status, 201, JSON.stringify(received.body));
      assert.deepEqual(await request("/sync/caixa-movimentos", firstDevice.accessToken, movement), received);
      assert.equal((await request("/sync/caixa-movimentos", secondDevice.accessToken, movement)).status, 409);
      assert.equal((await request("/sync/caixa-movimentos", firstDevice.accessToken,
        { ...movement, valorCentavos: 600 })).status, 409);
      assert.equal((await request("/sync/caixa-movimentos", firstDevice.accessToken,
        { ...movement, movimentoUid: randomUUID(), tipo: "sangria", valorCentavos: 200,
          motivo: "cofre", criadoEm: "2026-09-14T09:20:00" })).status, 201);
    });
    const sale = {
      pedidoUid: randomUUID(), numero: 6535, cliente: "CLIENTE", turno: "teste", data: "2026-09-14T10:00:00",
      totalCentavos: 6200, operadorUid: operatorUid, turnoUid: shiftUid, numeroNoTurno: 1, cancelado: false,
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
      const foreign = { ...sale, pedidoUid: randomUUID(), numero: 6537,
        turnoUid: otherShiftUid, itens: sale.itens.map(i => ({ ...i, uid: randomUUID() })),
        pagamentos: sale.pagamentos.map(p => ({ ...p, uid: randomUUID() })) };
      assert.equal((await request("/sync/vendas", firstDevice.accessToken, foreign)).status, 409);
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
    await t.test("fechamento e novo turno por maquina", async () => {
      const before = await fetch(base + "/pdvs", { headers: { authorization: "Bearer " + adminToken } });
      const current = (await before.json()).find(m => m.uid === firstDevice.uid);
      assert.equal(current.vendasTurno, 1);
      assert.equal(current.totalTurnoCentavos, "6200");
      assert.equal(current.suprimentosCentavos, "500");
      assert.equal(current.sangriasCentavos, "200");
      const close = { encerramento: "2026-09-14T18:00:00", esperadoCentavos: 300,
        conferidoCentavos: 300, diferencaCentavos: 0 };
      const route = `/sync/turnos/${shiftUid}/encerramento`;
      assert.equal((await request(route, secondDevice.accessToken, close)).status, 404);
      const result = await request(route, firstDevice.accessToken, close);
      assert.equal(result.status, 201, JSON.stringify(result.body));
      assert.deepEqual(await request(route, firstDevice.accessToken, close), result);
      assert.equal((await request(route, firstDevice.accessToken,
        { ...close, conferidoCentavos: 600, diferencaCentavos: 300 })).status, 409);
      const nextUid = randomUUID();
      assert.equal((await request("/sync/turnos", firstDevice.accessToken,
        { ...opening, turnoUid: nextUid, abertura: "2026-09-15T09:00:00" })).status, 201);
      const listed = await fetch(base + "/pdvs", { headers: { authorization: "Bearer " + adminToken } });
      const machines = await listed.json();
      const machine = machines.find(m => m.uid === firstDevice.uid);
      assert.equal(machine.turnoStatus, "aberto");
      assert.equal(machine.vendasTurno, 0);
      assert.equal(machine.caixaInicialCentavos, "0");
      assert.equal((await request(`/sync/turnos/${nextUid}/encerramento`, firstDevice.accessToken,
        { encerramento: "2026-09-15T18:00:00", esperadoCentavos: 0,
          conferidoCentavos: 0, diferencaCentavos: 0 })).status, 201);
      assert.equal((await request(`/sync/turnos/${otherShiftUid}/encerramento`, secondDevice.accessToken,
        { encerramento: "2026-09-14T18:00:00", esperadoCentavos: 0,
          conferidoCentavos: 0, diferencaCentavos: 0 })).status, 201);
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
    await require("./pdv-products.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    await require("./admin-catalog.cjs")(t, db, base, adminToken, firstDevice.accessToken, run);
    await require("./admin-references.cjs")(t, db, base, adminToken, firstDevice.accessToken, run);
    await require("./admin-destinations.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    await require("./admin-stock.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    await require("./admin-entries.cjs")(t, db, base, adminToken, firstDevice.accessToken, run);
    await require("./admin-shifts.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    await require("./admin-sales.cjs")(t, db, base, adminToken, firstDevice.accessToken);
    await require("./admin-reports.cjs")(t, base, adminToken, firstDevice.accessToken);
    await require("./admin-users.cjs")(t, db, base, adminToken, firstDevice.accessToken, request);
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
