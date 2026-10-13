import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import vm from 'node:vm';

const probeSource = await readFile(new URL('../src/content/network-probe-main.js', import.meta.url), 'utf8');
const marker = 'governanca-ai-network-probe-v1';

function makeProbe(fetchImpl) {
  const listeners = new Map();
  const events = [];
  const window = {
    fetch: fetchImpl,
    addEventListener: (type, listener) => listeners.set(type, listener),
    postMessage: data => events.push(JSON.parse(JSON.stringify(data)))
  };
  vm.runInNewContext(probeSource, {
    window,
    location: {href: 'https://chatgpt.com/c/synthetic', origin: 'https://chatgpt.com'},
    URL,
    crypto: webcrypto,
    TextDecoder,
    performance
  });
  return {
    window,
    events,
    enable() {
      listeners.get('message')({source: window, origin: 'https://chatgpt.com', data: {
        marker, phase: 'capture_config', enabled: true
      }});
    }
  };
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('captures allowlisted JSON metadata without forwarding signed download URLs', async () => {
  const response = new Response(JSON.stringify({
    status: 'success', download_url: 'https://signed.invalid/private-token',
    file_name: 'relatorio-sintetico.pdf', mime_type: 'application/pdf', file_size_bytes: 1234
  }), {headers: {'Content-Type': 'application/json'}});
  const probe = makeProbe(async () => response);
  probe.enable();

  await probe.window.fetch('https://chatgpt.com/backend-api/conversation/synthetic-id/interpreter/download');
  await settle();

  const item = probe.events.find(event => event.phase === 'artifact_metadata')?.payload;
  assert.ok(item);
  assert.equal(item.source, 'metadata_json');
  assert.equal(item.file_name, 'relatorio-sintetico.pdf');
  assert.equal(item.mime_type, 'application/pdf');
  assert.equal(item.size_bytes, 1234);
  assert.equal(response.bodyUsed, false);
  assert.equal(JSON.stringify(item).includes('signed.invalid'), false);
});

test('captures transfer headers only and never reads the artifact body', async () => {
  const response = new Response('CONTEUDO-SINTETICO-DO-ARQUIVO', {headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="teste.csv"',
    'Content-Length': '42'
  }});
  const probe = makeProbe(async () => response);
  probe.enable();

  await probe.window.fetch('https://chatgpt.com/backend-api/estuary/content?secret=not-forwarded');
  await settle();

  const item = probe.events.find(event => event.phase === 'artifact_metadata')?.payload;
  assert.ok(item);
  assert.equal(item.source, 'download_headers');
  assert.equal(item.file_name, 'teste.csv');
  assert.equal(item.mime_type, 'text/csv');
  assert.equal(item.size_bytes, 42);
  assert.equal(response.bodyUsed, false);
  assert.equal(JSON.stringify(item).includes('CONTEUDO-SINTETICO'), false);
  assert.equal(JSON.stringify(item).includes('secret'), false);
});

test('does not inspect artifact metadata while capture is paused', async () => {
  const probe = makeProbe(async () => new Response(JSON.stringify({
    file_name: 'ignorado.csv', mime_type: 'text/csv'
  }), {headers: {'Content-Type': 'application/json'}}));

  await probe.window.fetch('https://chatgpt.com/backend-api/conversation/synthetic-id/interpreter/download');
  await settle();

  assert.equal(probe.events.some(event => event.phase === 'artifact_metadata'), false);
});
