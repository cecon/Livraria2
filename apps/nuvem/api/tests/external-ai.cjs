const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const sharp = require('sharp');
const { fixture } = require('./agents-fixture.cjs');

test('IA externa: consentimento, descoberta, permissões, operação real, expiração, revogação e auditoria', { timeout: 180000 }, async t => {
  const f = await fixture({ worker: false }); t.after(f.close);
  await f.db.$executeRawUnsafe('create schema if not exists extensions');
  await f.db.$executeRawUnsafe('create extension if not exists pgcrypto with schema extensions');
  await f.db.$executeRawUnsafe("alter table usuario add column senha_hash text not null default ''");
  const password = randomBytes(18).toString('hex');
  await f.db.$executeRaw`update usuario set senha_hash=extensions.crypt(${password},extensions.gen_salt('bf'))`;
  const api = async (route, token, body) => {
    const r = await fetch('http://127.0.0.1:3310/api/v1' + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
    return { status: r.status, body: await r.json() };
  };
  async function request() {
    const r = await api('/ia/solicitacoes', null, { cliente: 'Teste isolado', finalidade: 'Conferir livro' });
    assert.equal(r.status, 201); assert.equal(r.body.token, undefined);
    assert.match(r.body.autorizar, /^\/ia\/autorizar\?solicitacao=/);
    return r.body.uid;
  }
  const pkce = verifier => createHash('sha256').update(verifier).digest('base64url');
  async function grant(mode, user = 'admin') {
    const uid = await request();
    const r = await api('/ia/autorizar', null, { solicitacaoUid: uid, usuario: user, senha: password, modo: mode, minutos: 60 });
    assert.equal(r.status, 201); assert.match(r.body.token, /^lia_[A-Za-z0-9_-]{43}$/);
    const details = await api('/ia/solicitacoes/' + uid);
    assert.equal(details.body.estado, 'autorizada'); assert.equal(details.body.token, undefined);
    return { ...r.body, request: uid };
  }
  const read = await grant('consulta'), write = await grant('alteracao'), operator = await grant('alteracao', 'operador');
  assert.equal((await api('/ia/catalogo')).status, 401);
  assert.equal((await api('/admin/livros', write.token)).status, 401, 'token temporário não funciona fora do gateway');
  const catalog = await api('/ia/catalogo', write.token);
  assert.equal(catalog.status, 200);
  const paths = catalog.body.paths;
  assert.ok(paths['/admin/categorias'].get);
  assert.ok(paths['/admin/livros'].get); assert.ok(paths['/admin/livros'].post);
  assert.ok(paths['/agentes/cadastro/fotos'].post); assert.ok(paths['/pdvs/{uid}/token'].post);
  assert.ok(paths['/admin/usuarios/{usuario}/senha'].put);
  assert.equal(paths['/auth/login'], undefined); assert.equal(paths['/sync/vendas'], undefined);
  assert.equal(paths['/ia/autorizar'], undefined);
  const operations = Object.values(paths).flatMap(Object.values);
  assert.equal(new Set(operations.map(o => o.operationId)).size, operations.length);
  assert.ok(operations.length >= 65, `catálogo incompleto: ${operations.length}`);
  const readDoc = (await api('/ia/catalogo', read.token)).body;
  assert.ok(Object.values(readDoc.paths).every(methods => Object.keys(methods).every(m => m === 'get')));
  const operatorDoc = (await api('/ia/catalogo', operator.token)).body;
  assert.ok(operatorDoc.paths['/agentes']); assert.equal(operatorDoc.paths['/admin/livros'], undefined);
  const call = (token, metodo, rota, corpo, consulta) => api('/ia/executar', token, { metodo, rota, corpo, consulta });
  const categories = await call(read.token, 'GET', '/admin/categorias');
  assert.equal(categories.status, 200);
  assert.deepEqual(categories.body.items.map(c => c.id + ':' + c.nome), ['0:Não Categorizado','1:Bíblias','2:Infantil','3:Família','4:Devocional','5:Estudo & Teologia','6:Ficção']);
  const books = await call(read.token, 'GET', '/admin/livros');
  assert.equal(books.status, 200); assert.equal(books.body.items[0].titulo, 'Livro local');
  const uid = books.body.items[0].sync_uid;
  const body = { codigo: '123', titulo: 'Atualizado por IA', autor: '', descricao: '', categoria: 0, preco_centavos: 1500 };
  assert.equal((await call(read.token, 'PUT', '/admin/livros/' + uid, body)).status, 403);
  assert.equal((await call(operator.token, 'PUT', '/admin/livros/' + uid, body)).status, 403);
  assert.equal((await call(write.token, 'PUT', '/admin/livros/' + uid, body)).status, 200);
  assert.equal((await call(read.token, 'GET', '/admin/livros')).body.items[0].titulo, 'Atualizado por IA');
  const shortBooks = await call(read.token, 'GET', '/admin/livros', undefined, { busca: 'Atualizado', limite: '1', resumo: '1' });
  assert.equal(shortBooks.status, 200);
  assert.equal(shortBooks.body.items.length, 1);
  assert.equal(shortBooks.body.items[0].titulo, 'Atualizado por IA');
  assert.equal(Object.hasOwn(shortBooks.body.items[0], 'complemento'), false);
  assert.equal(Object.hasOwn(shortBooks.body.items[0], 'descricao'), false);
  assert.equal((await call(read.token, 'PUT', '/admin/livros/' + uid + '/descricao', { descricao: 'Resumo lido da contracapa.' })).status, 403);
  const described = await call(write.token, 'PUT', '/admin/livros/' + uid + '/descricao', { descricao: 'Resumo lido da contracapa.' });
  assert.equal(described.status, 200, JSON.stringify(described.body));
  assert.equal(described.body.descricao, 'Resumo lido da contracapa.');
  assert.equal((await call(read.token, 'GET', '/admin/livros')).body.items.find(b => b.sync_uid === uid).descricao, 'Resumo lido da contracapa.');
  const fullBook = await call(read.token, 'GET', '/admin/livros/' + uid);
  assert.equal(fullBook.status, 200);
  assert.equal(fullBook.body.descricao, 'Resumo lido da contracapa.');
  assert.ok(fullBook.body.complemento);
  const coverImage = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#336699' } }).png().toBuffer();
  const imageBody = 'data:image/png;base64,' + coverImage.toString('base64');
  assert.equal((await call(read.token, 'PUT', '/admin/livros/' + uid + '/capa', { imagem: imageBody })).status, 403);
  const covered = await call(write.token, 'PUT', '/admin/livros/' + uid + '/capa',
    { imagem: imageBody, fonteNome: 'Foto enviada', fonteUrl: 'https://sextante.com.br/products/livro' });
  assert.equal(covered.status, 200, JSON.stringify(covered.body));
  assert.match(covered.body.capaUrl, /^\/api\/capas\/[0-9a-f-]{36}$/);
  const repeatedCover = await call(write.token, 'PUT', '/admin/livros/' + uid + '/capa',
    { imagem: imageBody, fonteNome: 'Foto enviada de novo', fonteUrl: 'https://sextante.com.br/products/livro' });
  assert.equal(repeatedCover.status, 200, JSON.stringify(repeatedCover.body));
  const withCover = await call(read.token, 'GET', '/admin/livros/' + uid);
  assert.equal(withCover.body.descricao, 'Resumo lido da contracapa.');
  assert.equal(withCover.body.complemento.capaUrl, repeatedCover.body.capaUrl);
  assert.equal(withCover.body.complemento.fontes.filter(f => f.url === 'https://sextante.com.br/products/livro').length, 1);
  assert.equal(withCover.body.complemento.fontes.find(f => f.url === 'https://sextante.com.br/products/livro').nome, 'Foto enviada de novo');
  assert.equal((await call(write.token, 'POST', '/auth/login', {})).status, 403);
  assert.equal((await call(write.token, 'POST', '/sync/vendas', {})).status, 403);
  assert.equal((await call(write.token, 'GET', '/admin/livros/../../auth/me')).status, 400);
  assert.equal((await call(write.token, 'GET', '/admin/livros', undefined, { destino: 'http://evil.test' })).status, 400);
  const [stored] = await f.db.$queryRaw`select token_hash,modo from ia_acesso where uid=${write.uid}::uuid`;
  assert.notEqual(stored.token_hash, write.token); assert.equal(stored.token_hash.length, 64);
  const repeat = await api('/ia/autorizar', null, { solicitacaoUid: write.request, usuario: 'admin', senha: password, modo: 'alteracao', minutos: 60 });
  assert.equal(repeat.status, 409);
  const audit = await f.request(`/ia/acessos/${write.uid}/historico`);
  assert.equal(audit.status, 200); assert.ok(audit.body.some(a => a.metodo === 'PUT' && a.status === 200));
  assert.equal(JSON.stringify(audit.body).includes(write.token), false);
  assert.equal((await f.request(`/ia/acessos/${write.uid}/revogar`, {}, 'operator')).status, 404);
  assert.equal((await f.request(`/ia/acessos/${write.uid}/revogar`, {})).status, 201);
  assert.equal((await api('/ia/catalogo', write.token)).status, 401);
  await f.db.$executeRaw`update ia_acesso set expira_em=now()-interval '1 second' where uid=${read.uid}::uuid`;
  assert.equal((await call(read.token, 'GET', '/admin/livros')).status, 401);
  await f.db.$executeRaw`update usuario set ativo=false where sync_uid=${f.ids.operator}::uuid`;
  assert.equal((await api('/ia/catalogo', operator.token)).status, 401);
  const expired = await request();
  await f.db.$executeRaw`update ia_solicitacao set expira_em=now()-interval '1 second' where uid=${expired}::uuid`;
  assert.equal((await api('/ia/autorizar', null, { solicitacaoUid: expired, usuario: 'admin', senha: password, modo: 'consulta', minutos: 60 })).status, 409);
  const once = await request();
  const consent = { solicitacaoUid: once, usuario: 'admin', senha: password, modo: 'consulta', minutos: 15 };
  assert.equal((await api('/ia/autorizar', null, { ...consent, senha: 'wrong-test-password' })).status, 401);
  assert.equal((await api('/ia/solicitacoes/' + once)).body.estado, 'pendente');
  const parallel = await Promise.all([api('/ia/autorizar', null, consent), api('/ia/autorizar', null, consent)]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [201, 409], 'apenas um consentimento emite token');
  const origin = 'https://livraria.test';
  const oauth = async (route, body, token, method = body === undefined ? 'GET' : 'POST') => {
    const r = await fetch('http://127.0.0.1:3310/api/v1' + route, { method,
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-ia-public-origin': origin, ...(token && { authorization: 'Bearer ' + token }) },
      ...(body !== undefined && { body: JSON.stringify(body) }) });
    const text = await r.text();
    return { status: r.status, headers: r.headers, body: text ? JSON.parse(text) : null };
  };
  assert.equal((await oauth('/ia/oauth/protected-resource')).body.resource, origin + '/mcp');
  const metadata = await oauth('/ia/oauth/metadata');
  assert.equal(metadata.body.authorization_endpoint, origin + '/api/ia/oauth/authorize');
  assert.equal(metadata.body.client_id_metadata_document_supported, true);
  const redirectUri = 'https://chatgpt.com/connector/oauth/test-callback';
  const client = await oauth('/ia/oauth/register', { client_name: 'ChatGPT Test', redirect_uris: [redirectUri] });
  assert.equal(client.status, 201); assert.match(client.body.client_id, /^lia_client_/);
  const verifier = 'v'.repeat(64);
  const oauthParams = { response_type: 'code', client_id: client.body.client_id, redirect_uri: redirectUri,
    code_challenge: pkce(verifier), code_challenge_method: 'S256', resource: origin + '/mcp',
    scope: 'livraria:read livraria:write mcp:tools', state: 'abc' };
  const auth = await oauth('/ia/oauth/authorize', { ...oauthParams, usuario: 'admin', senha: password });
  assert.equal(auth.status, 200);
  const callback = new URL(auth.body.redirect);
  assert.equal(callback.origin + callback.pathname, redirectUri);
  assert.equal(callback.searchParams.get('state'), 'abc');
  assert.equal(callback.searchParams.get('iss'), origin);
  const token = await oauth('/ia/oauth/token', { grant_type: 'authorization_code', code: callback.searchParams.get('code'),
    client_id: client.body.client_id, redirect_uri: redirectUri, code_verifier: verifier, resource: origin + '/mcp' });
  assert.equal(token.status, 200); assert.match(token.body.access_token, /^lia_[A-Za-z0-9_-]{43}$/);
  assert.equal(token.body.resource, origin + '/mcp');
  assert.equal((await oauth('/ia/oauth/token', { grant_type: 'authorization_code', code: callback.searchParams.get('code'),
    client_id: client.body.client_id, redirect_uri: redirectUri, code_verifier: verifier })).status, 401);
  const challenge = await oauth('/ia/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }, null);
  assert.equal(challenge.status, 401); assert.match(challenge.headers.get('www-authenticate'), /oauth-protected-resource/);
  const init = await oauth('/ia/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }, token.body.access_token);
  assert.equal(init.status, 200, JSON.stringify(init.body)); assert.equal(init.body.result.serverInfo.name, 'Livraria Espaco do Livro');
  const listed = await oauth('/ia/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, token.body.access_token);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.result.tools.length <= 25, `MCP deve expor lista curada, recebeu ${listed.body.result.tools.length}`);
  const categoriesTool = listed.body.result.tools.find(t => t.name === 'get__admin_categorias');
  assert.ok(categoriesTool); assert.match(categoriesTool.description, /categorias de livro/);
  const tool = listed.body.result.tools.find(t => t.name === 'get__admin_livros');
  assert.ok(tool); assert.equal(tool.annotations.readOnlyHint, true);
  assert.match(tool.description, /Busca livros\/produtos/);
  assert.match(tool.description, /Parâmetros esperados/);
  assert.doesNotMatch(tool.description, /^Consulta: GET/);
  assert.ok(tool.inputSchema.properties.consulta.properties.busca);
  assert.ok(tool.inputSchema.properties.consulta.properties.resumo);
  const fullTool = listed.body.result.tools.find(t => t.name === 'get__admin_livros_uid');
  assert.ok(fullTool); assert.match(fullTool.description, /Lê um livro completo/);
  const createTool = listed.body.result.tools.find(t => t.name === 'post__admin_livros');
  assert.ok(createTool); assert.match(createTool.description, /preco_centavos/);
  const describeTool = listed.body.result.tools.find(t => t.name === 'put__admin_livros_uid_descricao');
  assert.ok(describeTool); assert.match(describeTool.description, /descrição\/resumo do livro/);
  assert.match(describeTool.description, /"descricao"/);
  const coverTool = listed.body.result.tools.find(t => t.name === 'put__admin_livros_uid_capa');
  assert.ok(coverTool); assert.match(coverTool.description, /capa do livro/);
  assert.match(coverTool.description, /"capaUrl"/);
  const mcpBooks = await oauth('/ia/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get__admin_livros', arguments: {} } }, token.body.access_token);
  assert.equal(mcpBooks.status, 200);
  assert.match(mcpBooks.body.result.content[0].text, /Livro local|Atualizado por IA/);
  assert.doesNotMatch(mcpBooks.body.result.content[0].text, /criterios/);
  const claudeRedirect = 'https://claude.ai/api/mcp/auth_callback';
  const cimdUrl = 'http://127.0.0.1:3392/client.json';
  const cimd = createServer((_, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ client_id: cimdUrl, client_name: 'Claude Test', redirect_uris: [claudeRedirect], token_endpoint_auth_method: 'none' }));
  });
  await new Promise(resolve => cimd.listen(3392, '127.0.0.1', resolve));
  t.after(() => cimd.closeAllConnections?.() || cimd.close());
  const cimdParams = { response_type: 'code', client_id: cimdUrl, redirect_uri: claudeRedirect,
    code_challenge: pkce(verifier), code_challenge_method: 'S256', resource: origin + '/mcp',
    scope: 'livraria:read mcp:tools', state: 'claude' };
  const cimdAuth = await oauth('/ia/oauth/authorize', { ...cimdParams, usuario: 'admin', senha: password });
  assert.equal(cimdAuth.status, 200, JSON.stringify(cimdAuth.body) + '\n' + f.logs());
  const cimdCallback = new URL(cimdAuth.body.redirect);
  assert.equal(cimdCallback.origin + cimdCallback.pathname, claudeRedirect);
  const cimdToken = await oauth('/ia/oauth/token', { grant_type: 'authorization_code', code: cimdCallback.searchParams.get('code'),
    client_id: cimdUrl, redirect_uri: claudeRedirect, code_verifier: verifier, resource: origin + '/mcp' });
  assert.equal(cimdToken.status, 200); assert.match(cimdToken.body.access_token, /^lia_[A-Za-z0-9_-]{43}$/);
  console.log(`${operations.length} operações descobertas dos controllers; permissões e execução verificadas em PostgreSQL isolado.`);
});

