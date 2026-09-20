const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { encrypt, decrypt } = require('../dist/llm/credentials');
const { probe } = require('../dist/llm/provider');

test('OpenRouter autentica a chave antes de consultar metadados públicos', async () => {
  const original = global.fetch;
  const previous = process.env.LLM_ALLOWED_BASE_URLS;
  process.env.LLM_ALLOWED_BASE_URLS = 'https://openrouter.ai/api/v1';
  const config = { provedor: 'openai-compatible', endereco: 'https://openrouter.ai/api/v1', modelo: 'google/gemini-3.1-flash-lite' };
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, signal: options.signal });
      assert.equal(options.headers.authorization, 'Bearer chave-ficticia');
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ data: { id: config.modelo } }));
    };
    assert.equal((await probe(config, 'chave-ficticia')).ok, true);
    assert.deepEqual(calls.map(c => c.url), [`${config.endereco}/key`, `${config.endereco}/model/${config.modelo}`]);
    assert.equal(calls[0].signal, calls[1].signal);
    calls.length = 0;
    global.fetch = async url => { calls.push(url); return new Response('{}', { status: 401 }); };
    assert.equal((await probe(config, 'chave-ficticia')).codigo, 'HTTP_401');
    assert.equal(calls.length, 1);
    global.fetch = async () => new Response(JSON.stringify({ data: { id: 'outro/modelo' } }));
    assert.equal((await probe(config, 'chave-ficticia')).codigo, 'RESPOSTA_INVALIDA');
    global.fetch = async () => { throw new Error('timeout'); };
    assert.equal((await probe(config, 'chave-ficticia')).codigo, 'CONEXAO');
  } finally {
    global.fetch = original;
    if (previous === undefined) delete process.env.LLM_ALLOWED_BASE_URLS;
    else process.env.LLM_ALLOWED_BASE_URLS = previous;
  }
});

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
