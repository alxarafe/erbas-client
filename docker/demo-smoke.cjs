const assert = require('node:assert/strict');
(async () => {
  let response;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      response = await fetch('http://client/demo/defaults.env');
      if (response.status === 200) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(response?.status === 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(await response.text() === 'ERBAS_DEMO_ADMIN_EMAIL=runtime-admin@example.test\nERBAS_DEMO_ADMIN_PASSWORD=Runtime_admin_123=\nERBAS_DEMO_USER_EMAIL=runtime-user@example.test\nERBAS_DEMO_USER_PASSWORD=Runtime_user_123$\n');
  console.log('OK: public demo runtime resource preserves supplied values.');
})().catch(() => { console.error('Demo runtime resource verification failed.'); process.exitCode = 1; });
