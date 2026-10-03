const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { HttpErrorLogFilter, safeReason, safeSync } = require("../dist/diagnostics");

test("diagnostico retém somente motivos conhecidos e cursores numericos", () => {
  assert.equal(safeReason("senha=segredo", 409), "Operacao recusada pela API");
  assert.equal(safeReason("Cursor nao entregue", 409), "Cursor nao entregue");
  assert.deepEqual(safeSync({ solicitado: "734", aplicado: "775", entregue: "token=segredo", senha: "abc" }),
    { solicitado: "734", aplicado: "775" });
});

test("excecao interna nao expoe SQL, senha ou stack", () => {
  let body;
  const res = { locals: { requestId: randomUUID() }, status(code) { assert.equal(code, 500); return this; }, json(value) { body = value; } };
  new HttpErrorLogFilter().catch(new Error("postgres://usuario:senha@db/cliente"),
    { switchToHttp: () => ({ getResponse: () => res }) });
  assert.equal(body.message, "Falha interna da API");
  assert.ok(body.requestId);
  assert.doesNotMatch(JSON.stringify(body), /postgres|senha|cliente/);
});

test("HTTP real correlaciona resposta e log sem dados sensiveis", { timeout: 60000 }, async () => {
  const child = spawn(process.execPath, [require.resolve("../dist/main")], {
    env: { ...process.env, PORT: "3043", HOST: "127.0.0.1", API_OPERATIONS_ENABLED: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", data => { logs += data; });
  child.stderr.on("data", data => { logs += data; });
  const origin = "http://127.0.0.1:3043";
  try {
    let ready = false;
    for (let n = 0; n < 800; n++) {
      if (child.exitCode !== null) throw new Error("API de teste encerrou");
      try { if ((await fetch(origin + "/api/v1/health")).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready);
    const id = randomUUID();
    const response = await fetch(origin + "/segredo-no-caminho?senha=segredo-na-query", {
      headers: { "x-request-id": id, authorization: "Bearer segredo-no-header" },
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-request-id"), id);
    assert.equal((await response.json()).requestId, id);
    const replaced = await fetch(origin + "/api/v1/health", { headers: { "x-request-id": "segredo-id-invalido" } });
    assert.match(replaced.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(logs.includes(id));
    assert.ok(logs.includes('"status":404'));
    assert.doesNotMatch(logs, /segredo-no-caminho|segredo-na-query|segredo-no-header|segredo-id-invalido/);
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill();
      await exited;
    }
  }
});
