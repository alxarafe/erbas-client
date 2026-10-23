const PATCH_METHOD = 'PATCH';
const http = require('node:http');
const READ_STATUS = { ok: 200, created: 201, conflict: 409, invalidRequest: 400, unauthorized: 401, forbidden: 403, notFound: 404, redirect: 302, internalServerError: 500, serviceUnavailable: 503 };
const USER_HTTP = { accept: 'application/json', contentType: 'Content-Type', cacheControl: 'Cache-Control', noStore: 'no-store', challenge: 'WWW-Authenticate', bearer: 'Bearer' };
const ADMIN_BEARER = 'Bearer fictitious-mock-token';
const REGULAR_BEARER = 'Bearer fictitious-regular-token';
const USER_ERRORS = { invalidRequest: 'invalid_request', unauthorized: 'unauthorized', forbidden: 'forbidden', notFound: 'user_not_found', conflict: 'email_conflict', lastAdmin: 'last_admin' };
const USERS_ENDPOINT = '/api/users';
const REDIRECT_OFFSET = 302; // Deliberate collection redirect fixture.
const CURRENT_USER_ENDPOINT = '/api/auth/me';
const MOCK_USERS = [
  { id: 'opaque-a', email: 'mock@example.test', enabled: true, admin: true },
  { id: 'opaque-b', email: 'regular@example.test', enabled: true, admin: false },
  { id: 'opaque /?#% user', email: 'encoded@example.test', enabled: true, admin: false },
];
const PASSWORD_LENGTH = { minimum: 12, maximum: 256 };
const UPDATE_FIELDS = ['enabled', 'admin'];
const CREATE_FIELDS = 'admin,email,password';
const AI_ENDPOINT = '/api/ai/assistant/invocations';
const AI_MESSAGE_MAXIMUM = 4000;
const AI_CODES = {
  invalidRequest: 'invalid_request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  executionFailed: 'assistant_execution_failed',
  moduleDisabled: 'module_disabled',
  unavailable: 'assistant_unavailable',
};
const AI_FIXTURE_MESSAGES = {
  noTools: 'mock:no-tools',
  executionFailed: 'mock:execution-failed',
  moduleDisabled: 'mock:module-disabled',
  unavailable: 'mock:unavailable',
};
function validAiMessage(message) {
  if (typeof message !== 'string' || message.length === 0) return false;
  let scalars = 0;
  for (let index = 0; index < message.length; index++) {
    const unit = message.charCodeAt(index);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = message.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (++scalars > AI_MESSAGE_MAXIMUM) return false;
  }
  return /\S/u.test(message);
}
let checks = 0;
let aiInvocations = 0;
http.createServer((req, res) => {
  const aiUrl = new URL(req.url, 'http://mock');
  if (aiUrl.pathname === AI_ENDPOINT) {
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, {
        [USER_HTTP.contentType]: USER_HTTP.accept,
        [USER_HTTP.cacheControl]: USER_HTTP.noStore,
        ...headers,
      });
      res.end(JSON.stringify(body));
    };
    const failure = (status, code) => reply(status, { code, errors: [{ code }] },
      status === 401 ? { [USER_HTTP.challenge]: USER_HTTP.bearer } : {});
    if (req.method !== 'POST' || req.headers.accept !== USER_HTTP.accept) {
      failure(READ_STATUS.invalidRequest, AI_CODES.invalidRequest);
      return;
    }
    const bearer = req.headers.authorization;
    if (bearer !== ADMIN_BEARER && bearer !== REGULAR_BEARER) {
      failure(READ_STATUS.unauthorized, AI_CODES.unauthorized);
      return;
    }
    if (bearer === REGULAR_BEARER) {
      failure(READ_STATUS.forbidden, AI_CODES.forbidden);
      return;
    }
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(data); } catch {
        failure(READ_STATUS.invalidRequest, AI_CODES.invalidRequest);
        return;
      }
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== USER_HTTP.accept ||
          !body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).length !== 1 || !Object.hasOwn(body, 'message') ||
          !validAiMessage(body.message)) {
        failure(READ_STATUS.invalidRequest, AI_CODES.invalidRequest);
        return;
      }
      if (body.message === AI_FIXTURE_MESSAGES.executionFailed) {
        failure(READ_STATUS.internalServerError, AI_CODES.executionFailed);
        return;
      }
      if (body.message === AI_FIXTURE_MESSAGES.moduleDisabled) {
        failure(READ_STATUS.serviceUnavailable, AI_CODES.moduleDisabled);
        return;
      }
      if (body.message === AI_FIXTURE_MESSAGES.unavailable) {
        failure(READ_STATUS.serviceUnavailable, AI_CODES.unavailable);
        return;
      }
      const invocation = ++aiInvocations;
      reply(READ_STATUS.ok, {
        invocationId: `ai-invocation-${invocation}`,
        answer: 'Mock assistant answer.\nSecond line.',
        toolsUsed: body.message === AI_FIXTURE_MESSAGES.noTools ? [] : [
          { capabilityId: 'wms.uoms.list', invocationId: `core-invocation-${invocation}` },
        ],
      });
    });
    return;
  }
  if (req.url.startsWith(USERS_ENDPOINT)) {
    const url = new URL(req.url, 'http://mock');
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { [USER_HTTP.contentType]: USER_HTTP.accept, [USER_HTTP.cacheControl]: USER_HTTP.noStore, ...headers });
      res.end(JSON.stringify(body));
    };
    if (!['GET', 'POST', PATCH_METHOD].includes(req.method) || (req.method === PATCH_METHOD && url.pathname === USERS_ENDPOINT) || (req.method === 'POST' && url.pathname !== USERS_ENDPOINT) || req.headers.accept !== USER_HTTP.accept) {
      reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return;
    }
    const bearer = req.headers.authorization;
    const actor = bearer === ADMIN_BEARER ? MOCK_USERS[0] : bearer === REGULAR_BEARER ? MOCK_USERS[1] : null;
    if (!actor || !actor.enabled) {
      reply(READ_STATUS.unauthorized, { code: USER_ERRORS.unauthorized }, { [USER_HTTP.challenge]: USER_HTTP.bearer }); return;
    }
    if (!actor.admin) { reply(READ_STATUS.forbidden, { code: USER_ERRORS.forbidden }); return; }
    if (req.method === PATCH_METHOD) {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return; }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== USER_HTTP.accept ||
            !body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0 ||
            !Object.keys(body).every(field => UPDATE_FIELDS.includes(field) && typeof body[field] === 'boolean')) {
          reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return;
        }
        const id = decodeURIComponent(url.pathname.slice(USERS_ENDPOINT.length + 1));
        const index = MOCK_USERS.findIndex(user => user.id === id);
        if (index < 0) { reply(READ_STATUS.notFound, { code: USER_ERRORS.notFound }); return; }
        const updated = { ...MOCK_USERS[index], ...body };
        const enabledAdmins = MOCK_USERS.filter((user, position) => {
          const candidate = position === index ? updated : user;
          return candidate.enabled === true && candidate.admin === true;
        }).length;
        if (enabledAdmins === 0) { reply(READ_STATUS.conflict, { code: USER_ERRORS.lastAdmin }); return; }
        MOCK_USERS[index] = updated;
        reply(READ_STATUS.ok, updated);
      });
      return;
    }
    if (req.method === 'POST') {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return; }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== USER_HTTP.accept ||
            !body || Array.isArray(body) || Object.keys(body).sort().join(',') !== CREATE_FIELDS ||
            typeof body.email !== 'string' || body.email.length === 0 || typeof body.password !== 'string' ||
            Array.from(body.password).length < PASSWORD_LENGTH.minimum || Array.from(body.password).length > PASSWORD_LENGTH.maximum ||
            typeof body.admin !== 'boolean') {
          reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return;
        }
        if (MOCK_USERS.some(user => user.email === body.email)) {
          reply(READ_STATUS.conflict, { code: USER_ERRORS.conflict }); return;
        }
        const user = { id: `opaque-created-${MOCK_USERS.length}`, email: body.email, enabled: true, admin: body.admin };
        MOCK_USERS.push(user); // No password is retained in mock state.
        reply(READ_STATUS.created, user);
      });
      return;
    }
    if (url.pathname !== USERS_ENDPOINT) {
      if (!url.pathname.startsWith(USERS_ENDPOINT + '/')) { reply(READ_STATUS.notFound, { code: USER_ERRORS.notFound }); return; }
      const id = decodeURIComponent(url.pathname.slice(USERS_ENDPOINT.length + 1));
      if (id === 'redirect-fixture') { res.writeHead(READ_STATUS.redirect, { Location: 'http://unreachable.invalid/user' }).end(); return; }
      const user = MOCK_USERS.find(user => user.id === id);
      reply(user ? READ_STATUS.ok : READ_STATUS.notFound, user ?? { code: USER_ERRORS.notFound }); return;
    }
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      reply(READ_STATUS.invalidRequest, { code: USER_ERRORS.invalidRequest }); return;
    }
    if (offset === REDIRECT_OFFSET) { res.writeHead(READ_STATUS.redirect, { Location: 'http://unreachable.invalid/users' }).end(); return; }
    const users = [...MOCK_USERS].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    reply(READ_STATUS.ok, { items: users.slice(offset, offset + limit), offset, limit, total: users.length, order: [{ field: 'id', direction: 'asc' }] });
    return;
  }
  if (req.url === CURRENT_USER_ENDPOINT && req.method === 'GET') {
    const token = req.headers.authorization;
    const user = token === ADMIN_BEARER ? MOCK_USERS[0] :
      token === REGULAR_BEARER ? MOCK_USERS[1] : null;
    res.writeHead(user?.enabled ? READ_STATUS.ok : READ_STATUS.unauthorized, { [USER_HTTP.contentType]: USER_HTTP.accept, [USER_HTTP.cacheControl]: USER_HTTP.noStore,
      ...(user?.enabled ? {} : { [USER_HTTP.challenge]: USER_HTTP.bearer }) });
    res.end(JSON.stringify(user?.enabled ? user : { code: USER_ERRORS.unauthorized }));
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
