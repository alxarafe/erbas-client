const assert = require('node:assert/strict');
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
    const users = async (offset, limit, bearer = body.accessToken, method = 'GET') => fetch(
      `http://client/backends/${backend}/api/users?offset=${offset}&limit=${limit}`, {
        method, redirect: 'manual', headers: { Accept: 'application/json', Authorization: `Bearer ${bearer}` },
      });
    const listed = await users(1, 1);
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get('cache-control'), 'no-store');
    assert.equal(listed.headers.get('content-type'), 'application/json');
    assert.deepEqual(await listed.json(), {
      items: [{ id: 'opaque-b', email: 'regular@example.test', enabled: true, admin: false }],
      offset: 1, limit: 1, total: 2, order: [{ field: 'id', direction: 'asc' }],
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
    assert.equal((await users(0, 50, body.accessToken, 'POST')).status, 403);
    assert.equal((await fetch(`http://client/backends/${backend}/api/users/opaque-a`)).status, 404);
    console.log(`OK: ${backend} mock users proxy (bearer, query, 200/400/401/403, no-store and redirect blocking).`);
  }
  console.log('Runtime and proxy smoke tests passed (isolated mocks, no host ports).');
})().catch(error => { console.error('Runtime/proxy smoke verification failed.'); process.exitCode = 1; });
