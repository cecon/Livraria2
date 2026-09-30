const { assert, base, launch, login, visit, shot, fit, saved } = require('./browser-support.cjs');
(async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 960 }, acceptDownloads: true });
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/login');
    await page.getByLabel('Usuário', { exact: true }).fill(process.env.UI_TEST_USER || 'admin');
    await page.getByLabel('Senha', { exact: true }).fill(process.env.UI_TEST_PASSWORD);
    await saved(page, '/api/login', () => page.getByRole('button', { name: 'Entrar', exact: true }).click());
    await page.waitForURL(base + '/');
    const name = 'TESTE-' + Date.now();
    for (const [route, create, endpoint] of [
      ['/formas-pagamento', 'Nova forma', '/api/referencias/formas'],
      ['/destinacoes', 'Nova destinação', '/api/referencias/destinacoes'],
    ]) {
      await visit(page, route);
      await page.getByRole('button', { name: create, exact: true }).click();
      await page.getByLabel('Nome', { exact: true }).fill(name);
      await saved(page, endpoint, () => page.getByRole('button', { name: 'Criar', exact: true }).click());
      await fit(page); await shot(page, route.slice(1) + '-criado-390');
    }
    await visit(page, '/usuarios');
    await page.getByRole('button', { name: 'Novo usuário', exact: true }).click();
    await page.getByLabel('Usuário', { exact: true }).fill(name.toLowerCase());
    await page.getByLabel('Nome', { exact: true }).fill(name);
    await page.getByLabel('Senha', { exact: true }).fill('somente-banco-isolado');
    await saved(page, '/api/usuarios', () => page.getByRole('button', { name: 'Cadastrar', exact: true }).click());
    await page.getByRole('row').filter({ hasText: name.toLowerCase() }).waitFor();
    await visit(page, '/relatorios');
    await page.getByRole('radio', { name: 'Relatório de Estoque' }).check();
    await saved(page, '/api/relatorios/estoque', () => page.getByRole('button', { name: 'Emitir', exact: true }).click(), 'GET');
    await fit(page); await shot(page, 'relatorio-estoque-390');
    for (const [label, extension] of [['Baixar Excel', '.xlsx'], ['Baixar PDF', '.pdf']]) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: label, exact: true }).click();
      const download = await downloadPromise;
      assert.ok(download.suggestedFilename().endsWith(extension));
      assert.equal(await download.failure(), null);
    }
    // Cookies/servidor e MCP continuam protegidos; a mudança é de interface.
    const metadata = await page.request.get(base + '/.well-known/oauth-authorization-server');
    assert.equal(metadata.status(), 200);
    const mcp = await page.request.post(base + '/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'initialize' } });
    assert.equal(mcp.status(), 401);
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
    await page.waitForURL('**/login');
    assert.equal((await page.request.get(base + '/api/catalogo')).status(), 401);
    await page.goto(base + '/cadastro');
    await page.waitForURL('**/login**');
    await fit(page); await shot(page, 'login-390');
    assert.deepEqual(errors, []);
    console.log('Administração: login real, formas, destinações, usuário, relatórios PDF/XLSX, MCP protegido e logout OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
