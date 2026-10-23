const PATCH_METHOD = 'PATCH';
const assert = require('node:assert/strict');
const USERS_ENDPOINT = '/api/users';
const CURRENT_USER_ENDPOINT = '/api/auth/me';
const AI_ENDPOINT = '/api/ai/assistant/invocations';
const USER_HTTP = { accept: 'Accept', authorization: 'Authorization', json: 'application/json',
  contentType: 'content-type', cacheControl: 'cache-control', noStore: 'no-store', bearer: 'Bearer', challenge: 'www-authenticate' };
const USER_FIELDS = 'admin,email,enabled,id';
const USER_ERRORS = { invalidRequest: 'invalid_request', unauthorized: 'unauthorized', forbidden: 'forbidden', conflict: 'email_conflict', notFound: 'user_not_found', lastAdmin: 'last_admin' };
const AI_CODES = { invalidRequest: 'invalid_request', unauthorized: 'unauthorized', forbidden: 'forbidden',
  executionFailed: 'assistant_execution_failed', moduleDisabled: 'module_disabled', unavailable: 'assistant_unavailable' };
const AI_FIXTURE_MESSAGES = { noTools: 'mock:no-tools', executionFailed: 'mock:execution-failed',
  moduleDisabled: 'mock:module-disabled', unavailable: 'mock:unavailable' };
const READ_STATUS = { ok: 200, created: 201, invalidRequest: 400, conflict: 409, unauthorized: 401, forbidden: 403, notFound: 404, internalServerError: 500, badGateway: 502, serviceUnavailable: 503 };
(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await fetch('http://client/')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'Client must start');
  assert.equal((await fetch('http://client/demo/defaults.env')).status, 404);
  const html = await (await fetch('http://client/')).text();
  assert.match(html, /<app-root>/);
  const script = html.match(/src="(main[^"]+\.js)"/);
  assert.ok(script, 'Compiled application entry must exist');
  assert.equal((await fetch(`http://client/${script[1]}`)).status, 200);
  for (const backend of ['java', 'dotnet']) {
    const response = await fetch(`http://client/backends/${backend}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    const invalid = await fetch(`http://client/backends/${backend}/health`);
    assert.equal(invalid.status, 200);
    await assert.rejects(() => invalid.json());
    assert.equal((await fetch(`http://client/backends/${backend}/health`)).status, 503);
    const redirect = await fetch(`http://client/backends/${backend}/health`, { redirect: 'manual' });
    assert.equal(redirect.status, 502);
    assert.equal(redirect.headers.get('location'), null);
  }
  assert.equal((await fetch('http://client/backends/unknown/health')).status, 404);
  for (const backend of ['java', 'dotnet']) {
    const login = async body => fetch(`http://client/backends/${backend}/api/auth/login`, {
      method: 'POST', redirect: 'manual',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const success = await login({ email: 'mock@example.test', password: ' fictitious-demo-password\t ' });
    assert.equal(success.status, 200);
    assert.equal(success.headers.get('content-type'), 'application/json');
    assert.equal(success.headers.get('cache-control'), 'no-store');
    const body = await success.json();
    // Assertions never include the response or token in diagnostics.
    assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body));
    assert.ok(Object.keys(body).length === 1 && Object.hasOwn(body, 'accessToken'));
    assert.ok(typeof body.accessToken === 'string' && body.accessToken.length > 0);
    const denied = await login({ email: 'mock@example.test', password: 'deliberately-wrong' });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('content-type'), 'application/json');
    assert.equal(denied.headers.get('www-authenticate'), 'Bearer');
    assert.ok(JSON.stringify(await denied.json()) === '{"code":"invalid_credentials"}');
    const invalid = await login({});
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get('content-type'), 'application/json');
    assert.ok(JSON.stringify(await invalid.json()) === '{"code":"invalid_request"}');
    assert.equal((await fetch(`http://client/backends/${backend}/api/auth/register`)).status, 404);
    console.log(`OK: ${backend} mock login proxy (200/400/401 and headers).`);
    const assistantFetch = (payload, token = body.accessToken, method = 'POST') => fetch(
      `http://client/backends/${backend}${AI_ENDPOINT}`, {
        method, redirect: 'manual', headers: {
          [USER_HTTP.accept]: USER_HTTP.json,
          [USER_HTTP.contentType]: USER_HTTP.json,
          ...(token === null ? {} : { [USER_HTTP.authorization]: `${USER_HTTP.bearer} ${token}` }),
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
      });
    const assistant = (message, token = body.accessToken) => assistantFetch({ message }, token);
    const assistantError = async (message, token, status, code) => {
      const response = await assistant(message, token);
      assert.equal(response.status, status);
      assert.equal(response.headers.get(USER_HTTP.contentType), USER_HTTP.json);
      assert.equal(response.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
      assert.equal(response.headers.get(USER_HTTP.challenge),
        status === READ_STATUS.unauthorized ? USER_HTTP.bearer : null);
      assert.deepEqual(await response.json(), { code, errors: [{ code }] });
    };
    await assistantError('Reply with a short greeting.', null, READ_STATUS.unauthorized,
      AI_CODES.unauthorized);
    await assistantError('Reply with a short greeting.', 'fictitious-regular-token',
      READ_STATUS.forbidden, AI_CODES.forbidden);
    const answered = await assistant('List the available units of measure.');
    assert.equal(answered.status, READ_STATUS.ok);
    assert.equal(answered.headers.get(USER_HTTP.contentType), USER_HTTP.json);
    assert.equal(answered.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
    assert.equal(answered.headers.get(USER_HTTP.challenge), null);
    const answer = await answered.json();
    assert.deepEqual(Object.keys(answer).sort(), ['answer', 'invocationId', 'toolsUsed']);
    assert.ok(typeof answer.invocationId === 'string' && answer.invocationId.length > 0);
    assert.equal(answer.answer, 'Mock assistant answer.\nSecond line.');
    assert.deepEqual(answer.toolsUsed.map(tool => tool.capabilityId), ['wms.uoms.list']);
    assert.ok(answer.toolsUsed.every(tool => typeof tool.invocationId === 'string' &&
      tool.invocationId.length > 0 && tool.invocationId !== answer.invocationId));
    const direct = await assistant(AI_FIXTURE_MESSAGES.noTools);
    assert.equal(direct.status, READ_STATUS.ok);
    const directAnswer = await direct.json();
    assert.deepEqual(directAnswer.toolsUsed, []);
    assert.ok(directAnswer.invocationId !== answer.invocationId);
    await assistantError(AI_FIXTURE_MESSAGES.executionFailed, body.accessToken,
      READ_STATUS.internalServerError, AI_CODES.executionFailed);
    await assistantError(AI_FIXTURE_MESSAGES.moduleDisabled, body.accessToken,
      READ_STATUS.serviceUnavailable, AI_CODES.moduleDisabled);
    await assistantError(AI_FIXTURE_MESSAGES.unavailable, body.accessToken,
      READ_STATUS.serviceUnavailable, AI_CODES.unavailable);
    const malformedAssistant = await assistantFetch({ message: 42 });
    assert.equal(malformedAssistant.status, READ_STATUS.invalidRequest);
    assert.equal(malformedAssistant.headers.get(USER_HTTP.contentType), USER_HTTP.json);
    assert.equal(malformedAssistant.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
    assert.equal(malformedAssistant.headers.get(USER_HTTP.challenge), null);
    assert.deepEqual(await malformedAssistant.json(), {
      code: AI_CODES.invalidRequest, errors: [{ code: AI_CODES.invalidRequest }],
    });
    for (const method of ['GET', 'PATCH', 'PUT', 'DELETE'])
      assert.equal((await assistantFetch(undefined, body.accessToken, method)).status,
        READ_STATUS.forbidden);
    assert.equal((await fetch(`http://client/backends/${backend}${AI_ENDPOINT}/extra`,
      { method: 'POST' })).status, READ_STATUS.notFound);
    assert.equal((await fetch(`http://client/backends/unknown${AI_ENDPOINT}`,
      { method: 'POST' })).status, READ_STATUS.notFound);
    console.log(`OK: ${backend} assistant proxy (200/400/401/403/500/503, bearer, body, headers and method/path blocking).`);
    const users = async (offset, limit, bearer = body.accessToken, method = 'GET') => fetch(
      `http://client/backends/${backend}/api/users?offset=${offset}&limit=${limit}`, {
        method, redirect: 'manual', headers: { Accept: 'application/json', Authorization: `Bearer ${bearer}` },
      });
    const listed = await users(1, 1);
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get('cache-control'), 'no-store');
    assert.equal(listed.headers.get('content-type'), 'application/json');
    assert.deepEqual(await listed.json(), {
      items: [{ id: 'opaque-a', email: 'mock@example.test', enabled: true, admin: true }],
      offset: 1, limit: 1, total: 3, order: [{ field: 'id', direction: 'asc' }],
    });
    for (const [offset, limit, bearer, status, code] of [
      [-1, 50, body.accessToken, 400, 'invalid_request'],
      [0, 50, 'invalid-bearer', 401, 'unauthorized'],
      [0, 50, 'fictitious-regular-token', 403, 'forbidden'],
    ]) {
      const failure = await users(offset, limit, bearer);
      assert.equal(failure.status, status);
      assert.equal(failure.headers.get('cache-control'), 'no-store');
      assert.equal(failure.headers.get('www-authenticate'), status === 401 ? 'Bearer' : null);
      assert.deepEqual(await failure.json(), { code });
    }
    const redirected = await users(302, 50);
    assert.equal(redirected.status, 502);
    assert.equal(redirected.headers.get('location'), null);
    const createBody = { email: ' New-user@example.test ', password: ' 😀e\u0301 whitespace password ', admin: false };
    const create = (request, bearer = body.accessToken) => fetch(`http://client/backends/${backend}${USERS_ENDPOINT}`, {
      method: 'POST', redirect: 'manual', headers: {
        [USER_HTTP.accept]: USER_HTTP.json, [USER_HTTP.contentType]: USER_HTTP.json,
        [USER_HTTP.authorization]: `${USER_HTTP.bearer} ${bearer}`,
      }, body: JSON.stringify(request),
    });
    const created = await create(createBody);
    assert.equal(created.status, READ_STATUS.created);
    assert.equal(created.headers.get(USER_HTTP.contentType), USER_HTTP.json);
    assert.equal(created.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
    const newUser = await created.json();
    assert.ok(Object.keys(newUser).sort().join(',') === USER_FIELDS);
    assert.ok(newUser.email === createBody.email && newUser.admin === createBody.admin && newUser.enabled === true);
    assert.ok(typeof newUser.id === 'string' && newUser.id.length > 0);
    const afterCreate = await users(0, 50);
    const newWindow = await afterCreate.json();
    assert.equal(newWindow.total, 4);
    assert.ok(newWindow.items.some(user => JSON.stringify(user) === JSON.stringify(newUser)));
    assert.deepEqual(newWindow.items.map(user => user.id), newWindow.items.map(user => user.id).sort());
    for (const [request, bearer, status, code] of [
      [{ ...createBody, password: 'short' }, body.accessToken, READ_STATUS.invalidRequest, USER_ERRORS.invalidRequest],
      [createBody, 'invalid-bearer', READ_STATUS.unauthorized, USER_ERRORS.unauthorized],
      [createBody, 'fictitious-regular-token', READ_STATUS.forbidden, USER_ERRORS.forbidden],
      [createBody, body.accessToken, READ_STATUS.conflict, USER_ERRORS.conflict],
    ]) {
      const failure = await create(request, bearer);
      assert.equal(failure.status, status);
      assert.equal(failure.headers.get(USER_HTTP.contentType), USER_HTTP.json);
      assert.equal(failure.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
      assert.equal(failure.headers.get(USER_HTTP.challenge), status === READ_STATUS.unauthorized ? USER_HTTP.bearer : null);
      assert.ok(JSON.stringify(await failure.json()) === JSON.stringify({ code }));
    }
    console.log(`OK: ${backend} creation proxy (201/400/401/403/409, unchanged fields, coherent collection).`);
    const protectedGet = path => fetch(`http://client/backends/${backend}${path}`, {
      redirect: 'manual', headers: { [USER_HTTP.accept]: USER_HTTP.json,
        [USER_HTTP.authorization]: `${USER_HTTP.bearer} ${body.accessToken}` },
    });
    for (const path of [CURRENT_USER_ENDPOINT, `${USERS_ENDPOINT}/opaque-a`, `${USERS_ENDPOINT}/${encodeURIComponent('opaque /?#% user')}`]) {
      const response = await protectedGet(path);
      assert.equal(response.status, READ_STATUS.ok);
      assert.equal(response.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
      assert.equal(response.headers.get(USER_HTTP.contentType), USER_HTTP.json);
      const user = await response.json();
      assert.ok(Object.keys(user).sort().join(',') === USER_FIELDS);
      assert.ok(typeof user.id === 'string' && user.id.length > 0 && typeof user.email === 'string' && user.email.length > 0);
      assert.ok(typeof user.enabled === 'boolean' && typeof user.admin === 'boolean');
    }
    for (const path of [CURRENT_USER_ENDPOINT, `${USERS_ENDPOINT}/opaque-a`]) {
      const denied = await fetch(`http://client/backends/${backend}${path}`, { headers: { [USER_HTTP.accept]: USER_HTTP.json } });
      assert.equal(denied.status, READ_STATUS.unauthorized);
      assert.equal(denied.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
    }
    assert.equal((await protectedGet(`${USERS_ENDPOINT}/unknown-fixture`)).status, READ_STATUS.notFound);
    const redirectDetail = await protectedGet(`${USERS_ENDPOINT}/redirect-fixture`);
    assert.equal(redirectDetail.status, READ_STATUS.badGateway);
    assert.equal(redirectDetail.headers.get('location'), null);
    const patch = (id, request, bearer = body.accessToken) => fetch(`http://client/backends/${backend}${USERS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: PATCH_METHOD, redirect: 'manual', headers: {
        [USER_HTTP.accept]: USER_HTTP.json, [USER_HTTP.contentType]: USER_HTTP.json,
        [USER_HTTP.authorization]: `${USER_HTTP.bearer} ${bearer}`,
      }, body: JSON.stringify(request),
    });
    const opaqueId = 'opaque /?#% user';
    let expectedUser = await (await protectedGet(`${USERS_ENDPOINT}/${encodeURIComponent(opaqueId)}`)).json();
    for (const changes of [{ enabled: false }, { admin: true }, { enabled: true, admin: false }]) {
      const response = await patch(opaqueId, changes);
      assert.equal(response.status, READ_STATUS.ok);
      assert.equal(response.headers.get(USER_HTTP.contentType), USER_HTTP.json);
      assert.equal(response.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
      const updated = await response.json();
      expectedUser = { ...expectedUser, ...changes };
      assert.deepEqual(updated, expectedUser);
      assert.deepEqual(await (await protectedGet(`${USERS_ENDPOINT}/${encodeURIComponent(opaqueId)}`)).json(), updated);
      const window = await (await users(0, 50)).json();
      assert.deepEqual(window.items.find(user => user.id === opaqueId), updated);
      assert.equal(window.total, newWindow.total);
      assert.deepEqual(window.order, newWindow.order);
    }
    const unchangedAdmin = await (await protectedGet(`${USERS_ENDPOINT}/opaque-a`)).json();
    for (const [id, request, bearer, status, code] of [
      [opaqueId, {}, body.accessToken, READ_STATUS.invalidRequest, USER_ERRORS.invalidRequest],
      [opaqueId, { enabled: 'false' }, body.accessToken, READ_STATUS.invalidRequest, USER_ERRORS.invalidRequest],
      [opaqueId, { enabled: false, email: 'extra' }, body.accessToken, READ_STATUS.invalidRequest, USER_ERRORS.invalidRequest],
      [opaqueId, { enabled: false }, 'invalid-bearer', READ_STATUS.unauthorized, USER_ERRORS.unauthorized],
      ['absent', { enabled: false }, 'fictitious-regular-token', READ_STATUS.forbidden, USER_ERRORS.forbidden],
      ['absent', { admin: true }, body.accessToken, READ_STATUS.notFound, USER_ERRORS.notFound],
      ['opaque-a', { enabled: false }, body.accessToken, READ_STATUS.conflict, USER_ERRORS.lastAdmin],
      ['opaque-a', { admin: false }, body.accessToken, READ_STATUS.conflict, USER_ERRORS.lastAdmin],
      ['opaque-a', { enabled: false, admin: false }, body.accessToken, READ_STATUS.conflict, USER_ERRORS.lastAdmin],
    ]) {
      const failure = await patch(id, request, bearer);
      assert.equal(failure.status, status);
      assert.equal(failure.headers.get(USER_HTTP.contentType), USER_HTTP.json);
      assert.equal(failure.headers.get(USER_HTTP.cacheControl), USER_HTTP.noStore);
      assert.equal(failure.headers.get(USER_HTTP.challenge), status === READ_STATUS.unauthorized ? USER_HTTP.bearer : null);
      assert.deepEqual(await failure.json(), { code });
    }
    assert.deepEqual(await (await protectedGet(`${USERS_ENDPOINT}/opaque-a`)).json(), unchangedAdmin);
    assert.equal((await fetch(`http://client/backends/${backend}${CURRENT_USER_ENDPOINT}`, { method: PATCH_METHOD })).status, READ_STATUS.forbidden);
    assert.equal((await fetch(`http://client/backends/${backend}${USERS_ENDPOINT}/opaque-a/extra`, { method: PATCH_METHOD })).status, READ_STATUS.notFound);
    console.log(`OK: ${backend} PATCH detail (200/400/401/403/404/409), stateful reads, opaque ID and atomic last_admin.`);
    for (const method of ['POST', 'DELETE']) {
      const mutation = await fetch(`http://client/backends/${backend}${USERS_ENDPOINT}/opaque-a`, { method });
      assert.equal(mutation.status, READ_STATUS.forbidden);
      assert.equal((await fetch(`http://client/backends/${backend}${CURRENT_USER_ENDPOINT}`, { method })).status, READ_STATUS.forbidden);
    }
    for (const method of [PATCH_METHOD, 'DELETE'])
      assert.equal((await fetch(`http://client/backends/${backend}${USERS_ENDPOINT}`, { method })).status, READ_STATUS.forbidden);
    assert.equal((await fetch(`http://client/backends/${backend}${USERS_ENDPOINT}/opaque-a/extra`)).status, READ_STATUS.notFound);
    console.log(`OK: ${backend} profile and GET/PATCH detail proxies, encoded opaque ID, no-store, 401/404 and redirect/mutation blocking.`);
    console.log(`OK: ${backend} mock users proxy (bearer, query, 200/400/401/403, no-store and redirect blocking).`);
  }
  console.log('Runtime and proxy smoke tests passed (isolated mocks, no host ports).');
})().catch(error => { console.error('Runtime/proxy smoke verification failed.'); process.exitCode = 1; });
