const { assert, output, launch, login, visit, shot, fit } = require('./browser-support.cjs');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const routes = ['/', '/cadastro', '/pesquisa', '/lancamentos', '/inventario', '/fornecedores',
  '/formas-pagamento', '/destinacoes', '/venda', '/turnos', '/relatorios', '/pdvs', '/usuarios', '/llms'];
(async () => {
  const browser = await launch();
  const results = [];
  try {
    for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.addInitScript(mode => localStorage.setItem('livraria-cloud-theme', mode), mode);
      await login(page);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message.split('\n')[0]));
      page.on('response', response => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      for (const route of routes) {
        await visit(page, route);
        assert.equal(await page.locator('h1').count(), 1, route);
        await fit(page);
        if (route === '/') {
          if (width < 1024) {
            await page.getByRole('button', { name: 'Abrir menu' }).click();
            await page.getByRole('navigation').getByRole('link', { name: 'Livros', exact: true }).waitFor();
            await page.keyboard.press('Escape');
          } else {
            await page.getByRole('button', { name: 'Recolher menu' }).click();
            await page.getByRole('button', { name: 'Expandir menu' }).click();
          }
          await page.getByRole('button', { name: 'Alternar tema' }).click();
          await page.getByRole('button', { name: 'Alternar tema' }).click();
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(400);
        await shot(page, `${route.slice(1) || 'painel'}-${width}-${mode}`);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const violations = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) }));
        results.push({ route, width, mode, violations });
        fs.writeFileSync(path.join(output, 'accessibility.json'), JSON.stringify(results, null, 2));
        console.log(`${width} ${mode} ${route}: ${violations.length} violações`);
      }
      assert.deepEqual(errors, [], 'Erros de JavaScript ou HTTP');
      await context.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'accessibility.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
  assert.equal(results.flatMap(r => r.violations).length, 0, 'Verifique accessibility.json');
})().catch(error => { console.error(error); process.exitCode = 1; });
