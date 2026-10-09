const http = require('node:http');
let checks = 0;
http.createServer((req, res) => {
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
