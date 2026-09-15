const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

test("autenticacao, identidade e protocolo de catalogo em PostgreSQL isolado", { timeout: 30000 }, async t => {
  // Explicit opt-in prevents running destructive fixtures against a real database.
  assert.equal(process.env.API_TEST_DATABASE, "isolated-local");
  assert.match(process.env.DATABASE_URL ?? "", /@127\.0\.0\.1:55439\/livraria_test/);
  const db = new PrismaClient();
  const adminUid = randomUUID();
  const operatorUid = randomUUID();
  const productUid = randomUUID();
  let child;
  const base = "http://127.0.0.1:3003/api/v1";
  const password = randomUUID();
  async function request(route, token, body) {
    const response = await fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    await db.$executeRawUnsafe("drop schema public cascade");
    await db.$executeRawUnsafe("create schema public");
    await db.$executeRawUnsafe("create extension if not exists pgcrypto");
    await db.$executeRawUnsafe(`create table public.usuario (
      sync_uid uuid primary key, usuario text unique, senha_hash text,
      perfil text, ativo boolean default true, excluido_em timestamptz)`);
    await db.$executeRawUnsafe(`create table public.livro (
      sync_uid uuid primary key, codigo text unique not null, titulo text not null,
      autor text, preco_centavos bigint default 0, categoria integer default 0,
      descricao text, busca_norm text default '', ativo boolean default true,
      excluido_em timestamptz)`);
    await db.$executeRaw`insert into public.usuario(sync_uid,usuario,senha_hash,perfil)
      values(${adminUid}::uuid,'admin',crypt(${password},gen_salt('bf')),'admin'),
      (${operatorUid}::uuid,'operador',crypt(${password},gen_salt('bf')),'operador')`;
    const sql = fs.readFileSync(path.resolve(__dirname, "../sql/001_protocolo_catalogo.sql"), "utf8");
    // psql supports the multi-statement migration; input contains no credentials.
    const { execFileSync } = require("node:child_process");
    execFileSync("docker", ["exec", "-i", "livraria-separacao-db", "psql",
      "-U", "postgres", "-d", "livraria_test", "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "pipe", "pipe"] });
    child = spawn(process.execPath, [path.resolve(__dirname, "../dist/main.js")], {
      env: { ...process.env, PORT: "3003", API_OPERATIONS_ENABLED: "true", API_JWT_SECRET: randomUUID() + randomUUID() },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error("API de teste nao iniciou");
      try { if ((await fetch(base + "/health")).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const adminToken = (await request("/auth/login", null, { usuario: "admin", senha: password })).body.accessToken;
    const operatorToken = (await request("/auth/login", null, { usuario: "operador", senha: password })).body.accessToken;
    assert.ok(adminToken);
    assert.ok(operatorToken);
    await t.test("credenciais e permissoes", async () => {
      assert.ok((await request("/auth/login", null, { usuario: "  AdMiN  ", senha: password })).body.accessToken);
      assert.equal((await request("/auth/login", null, { usuario: "admin", senha: "errada" })).status, 401);
      assert.equal((await request("/auth/me")).status, 401);
      assert.equal((await request("/auth/me", adminToken + "alterado")).status, 401);
      assert.equal((await request("/pdvs", operatorToken, { nome: "caixa", usuarioUid: operatorUid })).status, 403);
      assert.equal((await request("/auth/me", adminToken)).body.perfil, "admin");
    });
    const enrolled = await request("/pdvs", adminToken, { nome: "caixa teste", usuarioUid: operatorUid });
    assert.equal(enrolled.status, 201);
    const deviceUid = enrolled.body.uid;
    const refreshToken = enrolled.body.refreshToken;
    let token = enrolled.body.accessToken;
    await t.test("produto conserva UUID na troca 503 para ISBN", async () => {
      await db.$executeRaw`insert into public.livro(sync_uid,codigo,titulo,preco_centavos)
        values(${productUid}::uuid,'503','Livro teste',6000)`;
      await db.$executeRaw`update public.livro set codigo='9786585995887' where sync_uid=${productUid}::uuid`;
      await assert.rejects(db.$executeRaw`insert into public.livro(sync_uid,codigo,titulo)
        values(${randomUUID()}::uuid,'9786585995887','Duplicado')`);
      await assert.rejects(db.$executeRaw`update public.livro set sync_uid=${randomUUID()}::uuid
        where sync_uid=${productUid}::uuid`);
      await assert.rejects(db.$executeRaw`update public.livro set preco_centavos=9007199254740992
        where sync_uid=${productUid}::uuid`);
      const response = await request("/sync/catalogo?limite=1", token);
      assert.equal(response.status, 200);
      const first = response.body;
      assert.equal(first.alteracoes[0].produto.codigo, "503");
      assert.equal(first.alteracoes[0].produtoUid, productUid);
      assert.equal(first.temMais, true);
      assert.deepEqual((await request("/sync/catalogo?limite=1", token)).body, first);
      assert.equal((await request("/sync/catalogo/confirmacao", token, { cursorAplicado: "999" })).status, 409);
      assert.equal((await request("/sync/catalogo?cursor=" + first.proximoCursor, token)).status, 409);
      assert.equal((await request("/sync/catalogo/confirmacao", token, { cursorAplicado: first.proximoCursor })).status, 201);
      assert.equal((await request("/sync/catalogo/confirmacao", token, { cursorAplicado: first.proximoCursor })).status, 201);
      const second = (await request("/sync/catalogo", token)).body;
      assert.equal(second.alteracoes[0].produto.codigo, "9786585995887");
      assert.equal(second.alteracoes[0].produto.precoCentavos, 6000);
      assert.equal(second.alteracoes[0].produtoUid, productUid);
      await request("/sync/catalogo/confirmacao", token, { cursorAplicado: second.proximoCursor });
    });
    await t.test("exclusao explicita, rollback e migração reaplicavel", async () => {
      const before = await db.$queryRaw`select sequencia from public.nuvem_sync_contador`;
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRaw`update public.livro set preco_centavos=6100 where sync_uid=${productUid}::uuid`;
        throw new Error("rollback");
      }));
      assert.deepEqual(await db.$queryRaw`select sequencia from public.nuvem_sync_contador`, before);
      await db.$executeRaw`delete from public.livro where sync_uid=${productUid}::uuid`;
      const page = (await request("/sync/catalogo", token)).body;
      assert.equal(page.alteracoes[0].operacao, "delete");
      assert.equal(page.alteracoes[0].produtoUid, productUid);
      assert.equal(page.alteracoes[0].produto, undefined);
      const softUid = randomUUID();
      await db.$executeRaw`insert into public.livro(sync_uid,codigo,titulo)
        values(${softUid}::uuid,'SOFT','Exclusao logica')`;
      await db.$executeRaw`update public.livro set excluido_em=now() where sync_uid=${softUid}::uuid`;
      const softEvents = await db.$queryRaw`select operacao from public.nuvem_catalogo_evento
        where produto_uid=${softUid}::uuid order by sequencia`;
      assert.deepEqual(softEvents.map(e=>e.operacao), ["upsert", "delete"]);
      const count = await db.$queryRaw`select count(*) from public.nuvem_catalogo_evento`;
      execFileSync("docker", ["exec", "-i", "livraria-separacao-db", "psql",
        "-U", "postgres", "-d", "livraria_test", "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "pipe", "pipe"] });
      assert.deepEqual(await db.$queryRaw`select count(*) from public.nuvem_catalogo_evento`, count);
    });
    await t.test("publicadores concorrentes nao ultrapassam commit pendente", async () => {
      let release;
      let acquired;
      const held = new Promise(resolve => { acquired = resolve; });
      const unblock = new Promise(resolve => { release = resolve; });
      const first = db.$transaction(async tx => {
        await tx.$executeRaw`insert into public.livro(sync_uid,codigo,titulo) values(${randomUUID()}::uuid,'A','A')`;
        acquired();
        await unblock;
      }, { timeout: 10000 });
      await held;
      let finished = false;
      const second = db.$executeRaw`insert into public.livro(sync_uid,codigo,titulo)
        values(${randomUUID()}::uuid,'B','B')`.then(() => { finished = true; });
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.equal(finished, false);
      } finally { release(); }
      await Promise.all([first, second]);
      const events = await db.$queryRaw`select produto->>'codigo' as codigo
        from public.nuvem_catalogo_evento where produto->>'codigo' in ('A','B') order by sequencia`;
      assert.deepEqual(events.map(e => e.codigo), ["A", "B"]);
    });
    await t.test("token de dispositivo vinculado e revogavel", async () => {
      assert.equal((await request("/auth/pdv/renovar", null, { pdvUid: deviceUid, refreshToken: "errado" })).status, 401);
      const renewed = await request("/auth/pdv/renovar", null, { pdvUid: deviceUid, refreshToken });
      assert.equal(renewed.status, 201);
      assert.ok(renewed.body.accessToken);
      assert.equal((await request("/sync/catalogo", adminToken)).status, 403);
      const rotated = await request("/pdvs/" + deviceUid + "/token", adminToken, {});
      assert.equal(rotated.status, 201);
      assert.equal((await request("/sync/catalogo", token)).status, 401);
      assert.equal((await request("/auth/pdv/renovar", null, { pdvUid: deviceUid, refreshToken })).status, 401);
      token = rotated.body.accessToken;
      assert.equal((await request("/auth/me", token)).body.pdvUid, deviceUid);
      await db.$executeRaw`update public.usuario set ativo=false where sync_uid=${operatorUid}::uuid`;
      assert.equal((await request("/auth/me", token)).status, 401);
      assert.equal((await request("/auth/me", operatorToken)).status, 401);
    });
    await t.test("limitacao de tentativas de login", async () => {
      let response;
      for (let n = 0; n < 11; n++) {
        response = await request("/auth/login", null, { usuario: "admin", senha: "errada" });
      }
      assert.equal(response.status, 429);
    });
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await db.$disconnect();
  }
});
