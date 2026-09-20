const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');

test('LLM: cadastro, migration repetida, identidade do turno e provedor isolados', { timeout: 90000 }, async t => {
  const container = `livraria-llm-test-${process.pid}`;
  const password = randomBytes(20).toString('hex');
  const jwtSecret = randomBytes(32).toString('hex');
  const key = randomBytes(32).toString('hex');
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:55441/llm_test`;
  let db, child, server, started = false;
  const adminUid = randomUUID(), operatorUid = randomUUID(), machineUid = randomUUID(), shiftUid = randomUUID();
  const jwt = new JwtService({ secret: jwtSecret, signOptions: { issuer: 'livraria-nuvem', audience: 'livraria-api', expiresIn: 900 } });
  const adminToken = jwt.sign({ sub: adminUid, tipo: 'usuario' });
  const operatorToken = jwt.sign({ sub: operatorUid, tipo: 'usuario' });
  const machineToken = jwt.sign({ sub: machineUid, tipo: 'pdv', versao: 1 });
  const base = 'http://127.0.0.1:3309/api/v1';
  let calls = 0;
  let mode = 'ok';
  async function req(url, token = adminToken, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(base + url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  }
  try {
    execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-p', '127.0.0.1:55441:5432',
      '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=llm_test', 'postgres:16-alpine'],
      { env: { ...process.env, POSTGRES_PASSWORD: password }, stdio: 'pipe' });
    started = true;
    db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    for (let i = 0; i < 100; i++) {
      try { await db.$queryRaw`select 1`; break; } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    for (const sql of [
      'create table usuario(sync_uid uuid primary key,usuario text,nome text,perfil text,ativo boolean default true,excluido_em timestamptz)',
      'create table nuvem_pdv(uid uuid primary key,usuario_uid uuid,ativo boolean default true,versao_token int default 1)',
      'create table turno_operacao(sync_uid uuid primary key,pdv_uid uuid,operador_uid uuid,status text,encerramento text,excluido_em timestamptz)',
    ]) await db.$executeRawUnsafe(sql);
    await db.$executeRaw`insert into usuario(sync_uid,usuario,perfil) values(${adminUid}::uuid,'admin','admin'),(${operatorUid}::uuid,'operador','operador')`;
    await db.$executeRaw`insert into nuvem_pdv(uid,usuario_uid) values(${machineUid}::uuid,${adminUid}::uuid)`;
    await db.$executeRaw`insert into turno_operacao(sync_uid,pdv_uid,operador_uid,status) values(${shiftUid}::uuid,${machineUid}::uuid,${operatorUid}::uuid,'aberto')`;
    const sql = fs.readFileSync(path.join(__dirname, '../sql/006_llm.sql'));
    for (let i = 0; i < 2; i++) execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'llm_test', '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
    server = createServer((req, res) => {
      calls++;
      assert.equal(req.headers.authorization, 'Bearer test-key');
      if (mode === 'redirect') { res.writeHead(302, { location: 'http://127.0.0.1:1/private' }); return res.end(); }
      if (mode === 'timeout') return;
      if (mode === 'error') { res.writeHead(401); return res.end('secret-provider-error'); }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: mode === 'invalid' ? 'outro-modelo' : 'modelo-teste' }));
    });
    await new Promise(r => server.listen(3389, '127.0.0.1', r));
    let logs = '';
    child = spawn(process.execPath, [path.join(__dirname, '../dist/main.js')], { stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, DATABASE_URL: databaseUrl, API_OPERATIONS_ENABLED: 'true', API_JWT_SECRET: jwtSecret,
      PORT: '3309', HOST: '127.0.0.1', LLM_ENCRYPTION_KEY: key, LLM_ALLOWED_BASE_URLS: 'http://127.0.0.1:3389/v1',
    } });
    child.stdout.on('data', data => { logs += data.toString(); });
    child.stderr.on('data', data => { logs += data.toString(); });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
      if (child.exitCode !== null) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, logs.replaceAll(password, '[redacted]').replaceAll(jwtSecret, '[redacted]').replaceAll(key, '[redacted]'));
    const data = { nome: 'LLM teste', provedor: 'openai-compatible', endereco: 'http://127.0.0.1:3389/v1',
      modelo: 'modelo-teste', credencial: 'test-key', ativo: true, pdv: true, retaguarda: true };
    assert.equal((await req('/admin/llms', machineToken, data)).status, 403);
    assert.equal((await req('/admin/llms', operatorToken, data)).status, 403);
    assert.equal((await req('/admin/llms', adminToken, { ...data, endereco: 'http://169.254.169.254' })).status, 400);
    const created = await req('/admin/llms', adminToken, data);
    assert.equal(created.status, 201);
    const uid = created.body.uid;
    assert.equal(created.body.possuiCredencial, true);
    assert.equal(created.body.credencial, undefined);
    const stored = await db.$queryRaw`select credencial from llm_configuracao where uid=${uid}::uuid`;
    assert.notEqual(stored[0].credencial, 'test-key');
    assert.match(stored[0].credencial, /^v1\./);
    assert.equal(JSON.stringify((await req('/admin/llms')).body).includes('test-key'), false);
    const updated = await req(`/admin/llms/${uid}`, adminToken, { ...data, credencial: '', nome: 'Editado', versao: 1 }, 'PUT');
    assert.equal(updated.status, 200);
    assert.equal(updated.body.versao, 2);
    assert.equal((await req(`/admin/llms/${uid}`, adminToken, { ...data, versao: 1 }, 'PUT')).status, 409);
    assert.equal((await req(`/admin/llms/${uid}/testar`, adminToken, {})).body.ok, true);
    const list = await req(`/llms?turnoUid=${shiftUid}`, machineToken);
    assert.equal(list.status, 200);
    assert.equal(list.body[0].endereco, undefined);
    assert.equal((await req(`/llms/${uid}/testar`, machineToken, { turnoUid: shiftUid, usuarioUid: adminUid })).body.ok, true);
    const audit = await db.$queryRaw`select usuario_uid::text,turno_uid::text,pdv_uid::text from llm_auditoria where pdv_uid=${machineUid}::uuid`;
    assert.equal(audit[0].usuario_uid, operatorUid);
    assert.equal(audit[0].turno_uid, shiftUid);
    let before = calls;
    assert.equal((await req(`/llms/${uid}/testar`, machineToken, { turnoUid: randomUUID() })).status, 403);
    await db.$executeRaw`update turno_operacao set pdv_uid=${randomUUID()}::uuid where sync_uid=${shiftUid}::uuid`;
    assert.equal((await req(`/llms/${uid}/testar`, machineToken, { turnoUid: shiftUid })).status, 403);
    await db.$executeRaw`update turno_operacao set pdv_uid=${machineUid}::uuid,status='encerrado' where sync_uid=${shiftUid}::uuid`;
    assert.equal((await req(`/llms/${uid}/testar`, machineToken, { turnoUid: shiftUid })).status, 403);
    await db.$executeRaw`update turno_operacao set status='aberto' where sync_uid=${shiftUid}::uuid`;
    await db.$executeRaw`update usuario set ativo=false where sync_uid=${operatorUid}::uuid`;
    assert.equal((await req(`/llms/${uid}/testar`, machineToken, { turnoUid: shiftUid })).status, 403);
    await db.$executeRaw`update usuario set ativo=true where sync_uid=${operatorUid}::uuid`;
    await db.$executeRaw`update nuvem_pdv set ativo=false where uid=${machineUid}::uuid`;
    assert.equal((await req(`/llms?turnoUid=${shiftUid}`, machineToken)).status, 401);
    await db.$executeRaw`update nuvem_pdv set ativo=true where uid=${machineUid}::uuid`;
    assert.equal(calls, before);
    for (const next of ['invalid', 'redirect', 'error', 'timeout']) {
      mode = next;
      const result = await req(`/admin/llms/${uid}/testar`, adminToken, {});
      assert.equal(result.body.ok, false);
      assert.equal(JSON.stringify(result).includes('secret-provider-error'), false);
    }
    mode = 'ok';
    const off = await req(`/admin/llms/${uid}`, adminToken, { ...data, versao: 2, ativo: false }, 'PUT');
    assert.equal(off.status, 200);
    before = calls;
    assert.equal((await req(`/admin/llms/${uid}/testar`, adminToken, {})).status, 403);
    assert.equal((await req(`/llms?turnoUid=${shiftUid}`, machineToken)).body.length, 0);
    assert.equal(calls, before);
    await t.test('migration repetida mantém registros', async () => {
      execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'llm_test', '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal((await req('/admin/llms')).body[0].versao, 3);
    });
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); }
    if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    if (db) await db.$disconnect();
    if (started) execFileSync('docker', ['stop', container], { stdio: 'pipe' });
  }
});
