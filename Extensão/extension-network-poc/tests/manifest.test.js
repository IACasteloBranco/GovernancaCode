import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('o pacote limita a injeção ao ChatGPT e a rede ao laboratório local', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*']);
  assert.equal(manifest.version, '0.3.3');
  assert.deepEqual(manifest.permissions, ['storage', 'tabs']);
  assert.deepEqual(manifest.content_scripts.map(script => [script.world, script.run_at]), [
    ['MAIN', 'document_start'], ['ISOLATED', 'document_start'], ['ISOLATED', 'document_idle']
  ]);
  assert.deepEqual(manifest.content_scripts[0].js, ['src/content/blocker-main.js', 'src/content/network-probe-main.js']);
  assert.deepEqual(manifest.content_scripts[1].js, ['src/content/platform.js', 'src/content/files.js',
    'src/content/policy-engine.js', 'src/content/policy-messages.js', 'src/content/blocker-bridge.js', 'src/content/network-bridge.js']);
  for (const script of manifest.content_scripts) assert.deepEqual(script.matches, ['https://chatgpt.com/*']);
  for (const path of [...manifest.content_scripts.flatMap(script => script.js), manifest.background.service_worker, manifest.action.default_popup]) {
    await readFile(new URL('../' + path, import.meta.url));
  }
  const worker = await readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');
  const observer = await readFile(new URL('../src/content/observer.js', import.meta.url), 'utf8');
  assert.match(worker, /adapter_version: '0\.3\.2-network'/);
  assert.match(observer, /adapter_version: '0\.3\.2-network'/);
});
