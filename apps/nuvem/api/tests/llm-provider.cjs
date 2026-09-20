const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { encrypt, decrypt } = require('../dist/llm/credentials');
const { probe } = require('../dist/llm/provider');

test('criptografia autenticada vincula credencial à configuração', () => {
  process.env.LLM_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const encrypted = encrypt('credencial-ficticia', 'config-a');
  assert.equal(decrypt(encrypted, 'config-a'), 'credencial-ficticia');
  assert.throws(() => decrypt(encrypted, 'config-b'));
  process.env.LLM_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  assert.throws(() => decrypt(encrypted, 'config-a'));
  delete process.env.LLM_ENCRYPTION_KEY;
  assert.throws(() => encrypt('teste', 'config-a'));
});

test('Google usa header de chave e valida o modelo sem gerar conteúdo', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-teste');
      assert.equal(options.headers['x-goog-api-key'], 'chave-ficticia');
      assert.equal(options.body, undefined);
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ name: 'models/gemini-teste' }));
    };
    assert.equal((await probe({ provedor: 'google', endereco: 'https://generativelanguage.googleapis.com/v1beta', modelo: 'models/gemini-teste' }, 'chave-ficticia')).ok, true);
    global.fetch = async () => new Response('x'.repeat(65537));
    assert.equal((await probe({ provedor: 'google', endereco: 'https://generativelanguage.googleapis.com/v1beta', modelo: 'gemini-teste' }, null)).ok, false);
  } finally { global.fetch = original; }
});
