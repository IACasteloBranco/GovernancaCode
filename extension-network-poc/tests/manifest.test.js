import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('o pacote limita a injeção ao ChatGPT e a rede ao laboratório local', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*']);
  assert.equal(manifest.version, '0.2.4');
  assert.deepEqual(manifest.content_scripts.map(script => [script.world, script.run_at]), [
    ['MAIN', 'document_start'], ['ISOLATED', 'document_start'], ['ISOLATED', 'document_idle']
  ]);
  for (const script of manifest.content_scripts) assert.deepEqual(script.matches, ['https://chatgpt.com/*']);
  for (const path of [...manifest.content_scripts.flatMap(script => script.js), manifest.background.service_worker, manifest.action.default_popup]) {
    await readFile(new URL('../' + path, import.meta.url));
  }
});
