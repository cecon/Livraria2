const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3025';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use somente servidor local com banco isolado.');
assert.equal(process.env.API_TEST_DATABASE, 'isolated-local');
assert.ok(process.env.UI_TEST_PASSWORD, 'Defina a senha do administrador do banco isolado.');
const output = process.env.UI_TEST_OUTPUT || path.resolve('test-results/able-pro');
fs.mkdirSync(output, { recursive: true });

async function launch() {
  return chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
}
async function login(page) {
  const response = await page.request.post(base + '/api/login', {
    data: { usuario: process.env.UI_TEST_USER || 'admin', senha: process.env.UI_TEST_PASSWORD },
  });
  assert.equal(response.status(), 200, await response.text());
}
async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !/Carregando[….]|Carregando (livros|catálogo|lançamentos|inventário|máquinas|vendas|turnos)/i.test(document.body.innerText));
  await page.waitForTimeout(350);
}
async function visit(page, route) {
  await page.goto(base + route);
  await ready(page);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
}
async function fit(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Conteúdo ultrapassa a largura da tela.');
}
async function saved(page, url, action, method = 'POST') {
  const waiting = page.waitForResponse(r => r.url().includes(url) && r.request().method() === method);
  await action();
  const response = await waiting;
  assert.ok(response.ok(), await response.text());
  return response.json();
}
module.exports = { assert, base, output, launch, login, ready, visit, shot, fit, saved };
