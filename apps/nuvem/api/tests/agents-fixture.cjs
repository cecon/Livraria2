const { randomBytes, randomUUID } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');

exports.fixture = async (options = {}) => {
  const name = `livraria-agents-test-${process.pid}`;
  const password = randomBytes(20).toString('hex'), key = randomBytes(32).toString('hex'), jwtKey = randomBytes(32).toString('hex');
  const ids = { admin: randomUUID(), operator: randomUUID(), machine: randomUUID(), shift: randomUUID(), skill: null, child: null, tool: null };
  const modelCalls = [], mcpCalls = [];
  let processApi, modelServer, mcpServer, db, logs = '';
  const close = async () => {
    processApi?.kill(); modelServer?.closeAllConnections(); modelServer?.close(); mcpServer?.closeAllConnections(); mcpServer?.close();
    await db?.$disconnect(); try { execFileSync('docker', ['rm', '-f', name], { stdio: 'pipe' }); } catch {}
  };
  try {
    execFileSync('docker', ['run', '--rm', '-d', '--name', name, '-p', '127.0.0.1:55442:5432', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=agents_test', 'postgres:16-alpine'],
      { env: { ...process.env, POSTGRES_PASSWORD: password }, stdio: 'pipe' });
    const url = `postgresql://postgres:${password}@127.0.0.1:55442/agents_test`;
    db = new PrismaClient({ datasources: { db: { url } } });
    for (let i = 0; i < 100; i++) { try { await db.$queryRaw`select 1`; break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    for (const sql of [
      'create table usuario(sync_uid uuid primary key,usuario text,nome text,perfil text,ativo boolean default true,excluido_em timestamptz)',
      'create table nuvem_pdv(uid uuid primary key,usuario_uid uuid,ativo boolean default true,versao_token int default 1)',
      'create table turno_operacao(sync_uid uuid primary key,pdv_uid uuid,operador_uid uuid,status text,encerramento text,excluido_em timestamptz)',
      "create table livro(sync_uid uuid primary key,codigo text unique,titulo text,autor text,preco_centavos bigint default 0,busca_norm text default '',ativo boolean default true,excluido_em timestamptz,categoria int default 0,descricao text,origem text default 'pdv',atualizado_em timestamptz,sincronizado_em timestamptz default now(),criado_por uuid)",
      'create table nuvem_sync_contador(id int primary key)',
      'insert into nuvem_sync_contador values(1)',
    ]) await db.$executeRawUnsafe(sql);
    await db.$executeRaw`insert into usuario(sync_uid,usuario,perfil) values(${ids.admin}::uuid,'admin','admin'),(${ids.operator}::uuid,'operador','operador')`;
    await db.$executeRaw`insert into nuvem_pdv(uid,usuario_uid) values(${ids.machine}::uuid,${ids.admin}::uuid)`;
    await db.$executeRaw`insert into turno_operacao(sync_uid,pdv_uid,operador_uid,status) values(${ids.shift}::uuid,${ids.machine}::uuid,${ids.operator}::uuid,'aberto')`;
    await db.$executeRaw`insert into livro(sync_uid,codigo,titulo,preco_centavos,busca_norm) values(${randomUUID()}::uuid,'123','Livro local',1250,'livro local')`;
    const migrate = () => { for (const file of ['006_llm.sql', '007_agents.sql', '008_book_assistant.sql', '009_book_photos.sql', '010_external_ai.sql', '011_ia_mcp_oauth.sql']) execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'agents_test', '-v', 'ON_ERROR_STOP=1'], { input: fs.readFileSync(path.join(__dirname, '../sql', file)), stdio: ['pipe', 'pipe', 'pipe'] }); };
    migrate(); migrate();
    modelServer = createServer(async (req, res) => {
      let body = ''; for await (const part of req) body += part;
      const data = JSON.parse(body); modelCalls.push(data);
      const index = data.messages.findLastIndex(m => m.role === 'user');
      const prompt = data.messages[index].content;
      if (prompt.includes('local')) await new Promise(r => setTimeout(r, 100));
      if (prompt.includes('provider-error')) { res.writeHead(503); return res.end('provider-secret-detail'); }
      if (prompt.includes('invalid-response')) { res.setHeader('content-type', 'application/json'); return res.end('{}'); }
      const answered = data.messages.slice(index + 1).some(m => m.role === 'tool');
      let tool = null;
      if (!answered && prompt.includes('skill')) tool = ['carregar_skill', { skillUid: ids.skill }];
      if (!answered && prompt.includes('pergunta')) tool = ['perguntar_usuario', { pergunta: 'Qual categoria?' }];
      if (!answered && prompt.includes('background')) tool = ['delegar_agente', { agenteUid: ids.child, tarefa: 'tarefa simples' }];
      if (!answered && prompt.includes('local')) tool = ['buscar_livros', { busca: 'Livro local' }];
      if (!answered && prompt.includes('external')) tool = [ids.tool, { texto: 'teste' }];
      if (prompt.includes('loop')) tool = ['consultar_tarefa', { execucaoUid: randomUUID() }];
      const message = tool ? { role: 'assistant', content: null, tool_calls: [{ id: randomUUID(), type: 'function', function: { name: tool[0], arguments: JSON.stringify(tool[1]) } }] }
        : { role: 'assistant', content: 'Resposta confirmada.' };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ finish_reason: tool ? 'tool_calls' : 'stop', message }], ...(!prompt.includes('unknown-usage') && { usage: { prompt_tokens: 30, completion_tokens: 20 } }) }));
    });
    mcpServer = createServer(async (req, res) => {
      let data = ''; for await (const part of req) data += part;
      const b = JSON.parse(data || '{}');
      if (!('id' in b)) { res.writeHead(202); return res.end(); }
      let result;
      if (b.method === 'initialize') result = { protocolVersion: b.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'isolated-test', version: '1' } };
      else if (b.method === 'tools/list') result = { tools: [{ name: 'echo', description: 'Ferramenta externa de teste', inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'], additionalProperties: false } }] };
      else if (b.method === 'tools/call') { mcpCalls.push(b.params); result = { content: [{ type: 'text', text: 'MCP confirmou' }] }; }
      else result = {};
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: b.id, result }));
    });
    await Promise.all([new Promise(r => modelServer.listen(3390, '127.0.0.1', r)), new Promise(r => mcpServer.listen(3391, '127.0.0.1', r))]);
    processApi = spawn(process.execPath, [path.join(__dirname, '../dist/main.js')], { stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, DATABASE_URL: url, API_OPERATIONS_ENABLED: 'true', API_JWT_SECRET: jwtKey, PORT: '3310', HOST: '127.0.0.1',
      LLM_ENCRYPTION_KEY: key, LLM_ALLOWED_BASE_URLS: 'http://127.0.0.1:3390/v1', AGENT_MCP_ALLOWED_URLS: 'http://127.0.0.1:3391/mcp', AGENT_WORKER_ENABLED: options.worker === false ? 'false' : 'true',
    } });
    processApi.stdout.on('data', d => { logs += d.toString(); }); processApi.stderr.on('data', d => { logs += d.toString(); });
    const base = 'http://127.0.0.1:3310/api/v1';
    let ready = false;
    for (let i = 0; i < 600; i++) {
      try { if ((await fetch(base + '/health', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
      if (processApi.exitCode !== null) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!ready) throw Error(logs.replaceAll(password, '[redacted]').replaceAll(key, '[redacted]').replaceAll(jwtKey, '[redacted]'));
    const jwt = new JwtService({ secret: jwtKey, signOptions: { issuer: 'livraria-nuvem', audience: 'livraria-api', expiresIn: 900 } });
    const tokens = { admin: jwt.sign({ sub: ids.admin, tipo: 'usuario' }), operator: jwt.sign({ sub: ids.operator, tipo: 'usuario' }), machine: jwt.sign({ sub: ids.machine, tipo: 'pdv', versao: 1 }) };
    async function request(route, body, who = 'admin', method = body === undefined ? 'GET' : 'POST') {
      const response = await fetch(base + route, { method, headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' }, ...(body !== undefined && { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    }
    return { db, ids, modelCalls, mcpCalls, request, migrate, logs: () => logs, close };
  } catch (error) { await close(); throw error; }
};
