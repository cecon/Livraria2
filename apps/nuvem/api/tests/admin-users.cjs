const assert = require("node:assert/strict");

module.exports = async function adminUsers(t, db, base, adminToken, deviceToken, request) {
  const call = async (method, path, body, token = adminToken) => {
    const response = await fetch(base + "/admin/usuarios" + path, { method,
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const username = "pessoa.teste";
  const password = "Senha-Teste-1";

  await t.test("usuarios exigem admin e cadastro canoniza login", async () => {
    assert.equal((await call("GET", "", undefined, deviceToken)).status, 403);
    const created = await call("POST", "", { usuario: " Pessoa.Teste ", nome: "Pessoa",
      perfil: "operador", senha: password });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const saved = await db.usuario.findUnique({ where: { usuario: username } });
    assert.equal(saved.usuario, username);
    assert.notEqual(saved.senha_hash, password);
    assert.equal((await call("POST", "", { usuario: "PESSOA.TESTE", nome: "Outra",
      perfil: "operador", senha: password })).status, 409);
  });

  await t.test("edicao senha e ativacao preservam identidade", async () => {
    assert.equal((await call("PUT", "/" + username, { nome: "Nome novo", perfil: "admin" })).status, 200);
    assert.equal((await db.usuario.findUnique({ where: { usuario: username } })).perfil, "admin");
    assert.equal((await call("PUT", `/${username}/senha`, { senha: "Nova-Senha-2" })).status, 200);
    assert.equal((await request("/auth/login", null, { usuario: "PESSOA.TESTE", senha: password })).status, 401);
    assert.ok((await request("/auth/login", null, { usuario: "PESSOA.TESTE", senha: "Nova-Senha-2" })).body.accessToken);
    assert.equal((await call("PUT", `/${username}/ativa`, { ativa: false })).status, 200);
    assert.equal((await request("/auth/login", null, { usuario: username, senha: "Nova-Senha-2" })).status, 401);
    assert.equal((await call("PUT", `/${username}/ativa`, { ativa: true })).status, 200);
  });

  await t.test("ultimo administrador ativo nao pode ser removido", async () => {
    const personToken = (await request("/auth/login", null,
      { usuario: username, senha: "Nova-Senha-2" })).body.accessToken;
    assert.equal((await call("PUT", "/admin", { nome: "Admin", perfil: "operador" })).status, 200);
    assert.equal((await call("PUT", `/${username}/ativa`, { ativa: false }, personToken)).status, 409);
    assert.equal((await call("PUT", `/${username}`, { nome: "Nome novo", perfil: "operador" }, personToken)).status, 409);
  });
};
