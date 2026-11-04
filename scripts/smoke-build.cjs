// Verify the compiled application, including copied translation assets.
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {createServer} = require('node:net');

async function verifyBuild() {
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const processUnderTest = spawn(process.execPath, ['dist/main.js'], {
    env: {...process.env, APP_HOST: '127.0.0.1', APP_PORT: String(port)},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [processUnderTest.stdout, processUnderTest.stderr]) {
    stream.on('data', chunk => { output = (output + chunk).slice(-8192); });
  }
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 15000;
    let ready = false;
    while (Date.now() < deadline && processUnderTest.exitCode === null) {
      try { ready = (await fetch(`${base}/api/hello`)).ok; } catch { /* Startup is asynchronous. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Compiled server did not become ready:\n${output}`);
    const greeting = await fetch(`${base}/api/hello?name=Lan&lang=vi`);
    assert.deepEqual(await greeting.json(), {message: 'Xin chào, Lan!', language: 'vi'});
    const schema = await (await fetch(`${base}/api/docs-json`)).json();
    assert.ok(schema.paths['/api/hello'].get);
    const documentation = await fetch(`${base}/api/docs`);
    assert.equal(documentation.status, 200);
    const html = await documentation.text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
    assert.ok(scripts.length >= 2, 'Swagger scripts must be present');
    for (const [, source] of scripts) {
      const asset = await fetch(new URL(source, `${base}/api/docs`));
      assert.equal(asset.status, 200, `Swagger asset ${source}`);
    }
    console.log('Compiled API, Vietnamese locale, Swagger schema and UI assets passed.');
  } finally {
    if (processUnderTest.exitCode === null) {
      const exited = once(processUnderTest, 'exit');
      processUnderTest.kill();
      await exited;
    }
  }
}

verifyBuild().catch(error => { console.error(error); process.exitCode = 1; });
