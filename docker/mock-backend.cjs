const http = require('node:http');
let checks = 0;
http.createServer((req, res) => {
  if (req.url.startsWith('/api/users')) {
    const url = new URL(req.url, 'http://mock');
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
      res.end(JSON.stringify(body));
    };
    if (url.pathname !== '/api/users' || req.method !== 'GET' || req.headers.accept !== 'application/json') {
      reply(400, { code: 'invalid_request' }); return;
    }
    const bearer = req.headers.authorization;
    if (bearer !== 'Bearer fictitious-mock-token' && bearer !== 'Bearer fictitious-regular-token') {
      reply(401, { code: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' }); return;
    }
    if (bearer === 'Bearer fictitious-regular-token') { reply(403, { code: 'forbidden' }); return; }
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      reply(400, { code: 'invalid_request' }); return;
    }
    if (offset === 302) { res.writeHead(302, { Location: 'http://unreachable.invalid/users' }).end(); return; }
    const users = [
      { id: 'opaque-a', email: 'mock@example.test', enabled: true, admin: true },
      { id: 'opaque-b', email: 'regular@example.test', enabled: true, admin: false },
    ];
    reply(200, { items: users.slice(offset, offset + limit), offset, limit, total: users.length, order: [{ field: 'id', direction: 'asc' }] });
    return;
  }
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      const reply = (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      };
      let body;
      try { body = JSON.parse(data); } catch { reply(400, { code: 'invalid_request' }); return; }
      if (req.headers.accept !== 'application/json' || req.headers['content-type'] !== 'application/json' ||
          req.headers.authorization || !body || typeof body.email !== 'string' || typeof body.password !== 'string') {
        reply(400, { code: 'invalid_request' }); return;
      }
      if (body.email !== 'mock@example.test' || body.password !== ' fictitious-demo-password\t ') {
        reply(401, { code: 'invalid_credentials' }, { 'WWW-Authenticate': 'Bearer' }); return;
      }
      reply(200, { accessToken: 'fictitious-mock-token' }, { 'Cache-Control': 'no-store' });
    });
    return;
  }
  if (req.url !== '/health' || req.headers.accept !== 'application/json') {
    res.writeHead(400).end(); return;
  }
  checks++;
  if (checks === 3) { res.writeHead(503).end(); return; }
  if (checks === 4) {
    res.writeHead(302, { Location: 'http://unreachable.invalid/health' }).end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(checks === 2 ? '{invalid json' : '{"status":"ok"}');
}).listen(8080, '0.0.0.0');
