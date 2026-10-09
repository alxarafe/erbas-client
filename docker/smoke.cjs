const assert = require('node:assert/strict');
(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await fetch('http://client/')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'Client must start');
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
  assert.equal((await fetch('http://client/backends/java/api/auth/login')).status, 404);
  console.log('Runtime and proxy smoke tests passed (isolated mocks, no host ports).');
})().catch(error => { console.error(error); process.exitCode = 1; });
