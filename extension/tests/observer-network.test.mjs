import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/observer.js', import.meta.url), 'utf8');
const prompt = 'Prompt sintético';
const answer = 'ABACATE 42 ✅';
const interactionId = '00000000-0000-4000-8000-000000000099';
const turnKey = '00000000-0000-4000-8000-000000000020';
let serial = 0;

function createObserver({attrs = new Map(), sent = [], sendMessage, promptText = `  ${prompt} \n`} = {}) {
  const listeners = new Map();
  const warnings = [];
  const field = {innerText: promptText};
  const user = {innerText: prompt};
  const turn = {getAttribute: name => name === 'data-turn-key' ? turnKey : null,
    querySelector: () => user};
  const root = {setAttribute: (key, value) => attrs.set(key, value)};
  const window = {addEventListener: (name, callback) => listeners.set(name, callback)};
  const chrome = {runtime: {sendMessage: async message => {
    sent.push(message);
    return sendMessage ? sendMessage(message) : {ok: true, data: message.type === 'capture_prompt'
      ? {interaction_id: interactionId} : {status: 'complete'}};
  }}};
  const context = {window, chrome, document: {documentElement: root,
    querySelectorAll: selector => selector.includes('data-turn-key') ? [turn] : [field]},
  location: {origin: 'https://chatgpt.com', pathname: '/g/g-p-123/c/00000000-0000-4000-8000-000000000030'},
  crypto: {randomUUID: () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`,
    subtle: webcrypto.subtle}, TextEncoder, Uint8Array, Date, Map, URL,
  console: {warn: (...items) => warnings.push(items)}};
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return {attrs, listeners, sent, context, warnings};
}

test('stores prompt and response together and restores a turn link after reload', async () => {
  const first = createObserver();
  first.context.GovernancaCaptureAttempt();
  const attemptId = first.attrs.get('data-governanca-probe-attempt');
  assert.equal(first.sent[0].payload.prompt.text, `  ${prompt} \n`);
  first.listeners.get('governanca-ai-network-capture')({detail: {
    attemptId, text: answer, captureStatus: 'complete'
  }});
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(first.sent[1].type, 'capture_response');
  assert.equal(first.sent[1].interactionId, interactionId);
  assert.equal(first.sent[1].payload.client_event_id, attemptId);
  assert.equal(first.sent[1].payload.text, answer);
  assert.equal(first.sent[2].type, 'remember_turn');
  assert.equal(first.sent[2].turnKey, turnKey);
  assert.deepEqual(first.warnings, []);
  const promptHash = first.sent[2].promptHash;
  assert.match(promptHash, /^[0-9a-f]{64}$/);

  const reloaded = createObserver({sendMessage: message => ({ok: true, data: message.type === 'lookup_turn'
    ? {interaction_id: interactionId, prompt_hash: promptHash} : {status: 'complete'}})});
  assert.equal(await reloaded.context.GovernancaCaptureRegeneration(prompt, turnKey), true);
  const regenerationId = reloaded.attrs.get('data-governanca-probe-attempt');
  assert.notEqual(regenerationId, attemptId);
  reloaded.listeners.get('governanca-ai-network-capture')({detail: {
    attemptId: regenerationId, text: 'Resposta regenerada', captureStatus: 'complete'
  }});
  await new Promise(resolve => setTimeout(resolve, 10));
  const response = reloaded.sent.find(item => item.type === 'capture_response');
  assert.equal(response.interactionId, interactionId);
  assert.equal(response.payload.client_event_id, regenerationId);
  assert.deepEqual(reloaded.warnings, []);
});

test('does not restore a turn link when its prompt hash differs', async () => {
  const reloaded = createObserver({sendMessage: message => ({ok: true, data: message.type === 'lookup_turn'
    ? {interaction_id: interactionId, prompt_hash: '0'.repeat(64)} : {status: 'complete'}})});
  assert.equal(await reloaded.context.GovernancaCaptureRegeneration(prompt, turnKey), false);
  assert.equal(reloaded.attrs.has('data-governanca-probe-attempt'), false);
});

test('keeps uploaded-file metadata on the prompt and accepts an attachment-only prompt', () => {
  const observation = {capture_status: 'observed', truncated: false, items: [{
    name: 'relatorio-sintetico.pdf', mime_type: 'application/pdf', size_bytes: 1234,
    capture_status: 'metadata_only', source: 'selection_event'
  }]};
  const observer = createObserver({promptText: ''});

  observer.context.GovernancaCaptureAttempt(observation);

  const payload = observer.sent[0].payload;
  assert.equal(payload.prompt.text, '');
  assert.equal(payload.attachments_capture_status, 'observed');
  assert.equal(payload.attachments_truncated, false);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.attachments)), observation.items);
});

test('does not create an empty prompt when no attachment was observed', () => {
  const observer = createObserver({promptText: ''});

  observer.context.GovernancaCaptureAttempt({capture_status: 'not_observed', items: [], truncated: false});

  assert.equal(observer.sent.length, 0);
  assert.equal(observer.attrs.has('data-governanca-probe-attempt'), false);
});
