import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('o pacote limita a injeção a ChatGPT e Claude e a rede ao laboratório local', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '0.6.13');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*']);
  assert.deepEqual(manifest.content_scripts.map(script => [script.world, script.run_at]), [
    ['MAIN', 'document_start'], ['ISOLATED', 'document_idle']
  ]);
  assert.deepEqual(manifest.content_scripts[1].js.slice(-2),
    ['src/content/blocker-bridge.js', 'src/content/observer.js']);
  for (const script of manifest.content_scripts) assert.deepEqual(script.matches, ['https://chatgpt.com/*', 'https://claude.ai/*']);
  for (const path of [...manifest.content_scripts.flatMap(script => script.js), manifest.background.service_worker, manifest.action.default_popup]) {
    await readFile(new URL('../' + path, import.meta.url));
  }
  const [worker, observer, diagnostics] = await Promise.all([
    readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/observer.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/popup/diagnostics.js', import.meta.url), 'utf8')
  ]);
  assert.match(worker, /adapter_version: '0\.6\.13'/);
  assert.match(observer, /adapter_version: '0\.6\.13'/);
  assert.match(diagnostics, /Extensão: 0\.6\.13/);
});
