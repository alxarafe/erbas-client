const http = require('node:http');
let checks = 0;
http.createServer((req, res) => {
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
