import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('o pacote limita a injeção ao ChatGPT e usa a API local de identidade', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*', 'http://127.0.0.1:8000/*']);
  assert.equal(manifest.version, '0.4.6');
  assert.deepEqual(manifest.permissions, ['storage', 'tabs']);
  assert.deepEqual(manifest.content_scripts.map(script => [script.world, script.run_at]), [
    ['MAIN', 'document_start'], ['ISOLATED', 'document_start']
  ]);
  assert.deepEqual(manifest.content_scripts[0].js, ['src/content/blocker-main.js', 'src/content/network-probe-main.js']);
  assert.deepEqual(manifest.content_scripts[1].js, ['src/content/platform.js', 'src/content/files.js', 'src/content/policy-engine.js',
    'src/content/policy-messages.js', 'src/content/observer.js', 'src/content/blocker-bridge.js', 'src/content/network-bridge.js']);
  for (const script of manifest.content_scripts) assert.deepEqual(script.matches, ['https://chatgpt.com/*']);
  for (const path of [...manifest.content_scripts.flatMap(script => script.js), manifest.background.service_worker, manifest.action.default_popup]) {
    await readFile(new URL('../' + path, import.meta.url));
  }
  const worker = await readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');
  assert.match(worker, /const API = 'http:\/\/127\.0\.0\.1:8000'/);
  assert.match(worker, /X-Machine-Signature/);
  assert.match(worker, /device_installation_id: installationId/);
  const popup = await readFile(new URL('../src/popup/popup.html', import.meta.url), 'utf8');
  assert.match(popup, /Captura prompts e respostas do ChatGPT/);
  assert.match(popup, /metadados observados registrados, sem leitura do conteúdo do arquivo/);
  assert.doesNotMatch(popup, /Não envia nem grava prompts ou respostas/);
});
