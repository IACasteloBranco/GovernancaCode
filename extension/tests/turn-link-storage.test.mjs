import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');
const turnKey = '00000000-0000-4000-8000-000000000020';
const interactionId = '00000000-0000-4000-8000-000000000099';
const promptHash = 'a'.repeat(64);

function worker() {
  const local = {};
  let onMessage;
  const storage = {
    async get(keys) {
      if (typeof keys === 'string') return {[keys]: local[keys]};
      return Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(local)).map(key => [key, local[key]]));
    },
    async set(values) { Object.assign(local, values); },
    async setAccessLevel() {}
  };
  const chrome = {storage: {local: storage, session: storage},
    runtime: {getURL: path => `chrome-extension://test/${path}`,
      onMessage: {addListener: listener => {onMessage = listener;}},
      onConnect: {addListener: () => {}}}};
  vm.runInNewContext(source, {chrome, crypto: webcrypto, URL, TextEncoder, Uint8Array,
    AbortSignal, fetch: async () => {throw new Error('unexpected fetch');}, console});
  const sender = {tab: {id: 1}, frameId: 0,
    url: 'https://chatgpt.com/g/g-p-test/c/00000000-0000-4000-8000-000000000030'};
  const send = (message, source = sender) => new Promise(resolve => onMessage(message, source, resolve));
  return {send, local};
}

test('persists bounded turn-to-interaction links and rejects foreign routes', async () => {
  const {send, local} = worker();
  const link = {conversationUrl: 'https://chatgpt.com/g/g-p-test/c/00000000-0000-4000-8000-000000000030',
    turnKey, interactionId, promptHash};
  const stored = await send({type: 'remember_turn', ...link});
  assert.equal(stored.ok, true);
  assert.equal(stored.data.stored, true);
  const found = await send({type: 'lookup_turn', conversationUrl: link.conversationUrl, turnKey});
  assert.equal(found.data.interaction_id, interactionId);
  assert.equal(found.data.prompt_hash, promptHash);
  assert.equal(local.turnLinks.length, 1);
  assert.equal((await send({type: 'remember_turn', ...link, conversationUrl: 'https://evil.example/c/turn'})).ok, false);

  await Promise.all(Array.from({length: 505}, (_, index) => send({type: 'remember_turn', ...link,
    turnKey: `00000000-0000-4000-8000-${String(index + 30).padStart(12, '0')}`})));
  assert.equal(local.turnLinks.length, 500);
});

test('reports a paused capture without storing prompt text', async () => {
  const {send, local} = worker();
  const result = await send({type: 'capture_prompt', payload: {prompt: {text: 'SYNTHETIC-PRIVATE-MARKER'}}});

  assert.equal(result.ok, false);
  assert.equal(local.captureDiagnostics.at(-1).stage, 'prompt_rejected');
  assert.equal(local.captureDiagnostics.at(-1).error_code, 'capture_paused');
  assert.equal(JSON.stringify(local.captureDiagnostics).includes('SYNTHETIC-PRIVATE-MARKER'), false);
});

test('reports an invalid prompt payload separately from a paused capture', async () => {
  const {send, local} = worker();
  local.enabled = true;
  const result = await send({type: 'capture_prompt', payload: {prompt: {text: 'SYNTHETIC-PRIVATE-MARKER'}}});

  assert.equal(result.ok, false);
  assert.equal(local.captureDiagnostics.at(-1).stage, 'prompt_rejected');
  assert.equal(local.captureDiagnostics.at(-1).error_code, 'invalid_prompt');
  assert.equal(JSON.stringify(local.captureDiagnostics).includes('SYNTHETIC-PRIVATE-MARKER'), false);
});

test('does not record prompt diagnostics for messages outside the ChatGPT tab', async () => {
  const {send, local} = worker();
  await send({type: 'capture_prompt', payload: {prompt: {text: 'SYNTHETIC-MARKER'}}},
    {tab: {id: 2}, frameId: 0, url: 'https://example.com/'});

  assert.equal(local.captureDiagnostics, undefined);
});

test('keeps actionable diagnostics when blocker health updates repeat', async () => {
  const {send, local} = worker();
  local.enabled = true;
  await send({type: 'capture_prompt', payload: {prompt: {text: 'SYNTHETIC-MARKER'}}});
  for (let index = 0; index < 40; index++)
    await send({type: 'blocker_health', mainActive: true, blocked: false,
      synchronized: true, mainBlocked: true});

  assert.equal(local.captureDiagnostics.some(item => item.stage === 'prompt_rejected' &&
    item.error_code === 'invalid_prompt'), true);
  assert.equal(local.captureDiagnostics.filter(item => item.stage === 'blocker_health').length, 1);
});
