const { assert, launch, login, visit, shot, fit } = require('./browser-support.cjs');
const { AxeBuilder } = require('@axe-core/playwright');
(async () => {
  const browser = await launch();
  try {
    for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(mode => localStorage.setItem('livraria-cloud-theme', mode), mode);
      await login(page);
      for (const route of ['/login', '/trocar-senha', '/ia/conectar', '/']) {
        await visit(page, route);
        await fit(page);
        await shot(page, `auth-${route.replaceAll('/', '-') || 'painel'}-${width}-${mode}`);
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.deepEqual(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], route);
      }
      await visit(page, '/trocar-senha');
      await page.getByLabel('Nova senha', { exact: true }).fill('senha-diferente-1');
      await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-diferente-2');
      await page.getByRole('button', { name: 'Salvar e continuar' }).click();
      await page.getByRole('alert').filter({ hasText: 'As senhas nao conferem.' }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`Autenticação, consentimento e painel ${width} ${mode}: OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
