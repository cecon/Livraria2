const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

module.exports = async function webCatalog(t, db, apiBase, adminToken, deviceToken) {
  const base = "http://127.0.0.1:3004";
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", "3004", "-H", "127.0.0.1"], {
    cwd: path.resolve(__dirname, "../../web"), stdio: "ignore",
    env: { ...process.env, API_CATALOGO_ENABLED: "true", NUVEM_API_URL: new URL(apiBase).origin,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder-build-only" },
  });
  const call = async (method, route, body, token = adminToken, origin = base) => {
    const response = await fetch(base + "/api/catalogo" + route, {
      method, headers: { origin, cookie: "nuvem_usuario=" + token, "content-type": "application/json" },
      ...(body && { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error("Web de teste nao iniciou");
      try { if ((await fetch(base + "/api/catalogo/config")).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const config = await call("GET", "/config");
    assert.equal(config.body.enabled, true, "Flag precisa ser runtime, nao embutida no build");
    await t.test("proxy Next real autentica, grava, altera e publica para PDV", async () => {
      const uid = randomUUID();
      const input = { sync_uid: uid, codigo: "WEB-503", titulo: "Produto via web", autor: "",
        descricao: "", categoria: 0, preco_centavos: 3100, estoqueInicial: 9 };
      assert.equal((await call("POST", "", input, "invalid")).status, 401);
      assert.equal((await call("POST", "", input, deviceToken)).status, 403);
      assert.equal((await call("POST", "", input, adminToken, "http://attacker.test")).status, 403);
      const created = await call("POST", "", input);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.sync_uid, uid);
      assert.equal((await call("PUT", "/" + uid, { ...input, codigo: "WEB-ISBN", estoqueInicial: 0, preco_centavos: 4500 })).status, 200);
      const book = await db.livro.findUnique({ where: { syncUid: uid } });
      assert.equal(book.codigo, "WEB-ISBN");
      assert.equal(book.precoCentavos, 4500n);
      const events = await db.$queryRaw`select produto from public.nuvem_catalogo_evento
        where produto_uid=${uid}::uuid order by sequencia desc limit 1`;
      assert.equal(events[0].produto.precoCentavos, 4500);
      assert.equal(events[0].produto.saldoPublicado, 9);
      assert.equal((await call("DELETE", "/" + uid)).status, 200);
      assert.equal((await db.livro.findUnique({ where: { syncUid: uid } })).ativo, false);
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
  }
};
