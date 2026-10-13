import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/network-bridge.js', import.meta.url), 'utf8');
const marker = 'governanca-ai-network-probe-v1';
const attemptId = 'a3cc6a9e-64be-44e4-a989-53dc971b5dd0';

test('envia somente metadados para stream_captures', async () => {
  const windowListeners = new Map();
  const sent = [];
  const window = {
    addEventListener: (type, callback) => windowListeners.set(type, callback),
    postMessage: data => windowListeners.get('message')?.({source: window, origin: 'https://chatgpt.com', data})
  };
  const chrome = {runtime: {
    onMessage: {addListener: callback => { chrome.listener = callback; }},
    sendMessage: async message => {
      sent.push(message);
      return message.type === 'probe_config' ? {ok: true, data: {enabled: true}} : {ok: true, data: {status: 'stored'}};
    }
  }};
  vm.runInNewContext(source, {window, chrome, location: {origin: 'https://chatgpt.com'}, Date, Map});
  chrome.listener({type: 'probe_config', enabled: true}, {}, () => {});

  windowListeners.get('message')({source: window, origin: 'https://chatgpt.com', data: {
    marker, transport: 'fetch', phase: 'stream_capture', attemptId,
    path: '/backend-api/f/conversation', captureStatus: 'complete', protocolDone: true,
    readerDone: false, readerAbortedAfterDone: true, truncated: false, status: 200,
    contentType: 'text/event-stream', requestId: 1, responseChars: 18, bytes: 42,
    chunks: 2, frames: 3, doneMarkers: 1, streamElapsedMs: 100,
    eventTypes: [], eventShapes: [], eventSequence: [],
    promptText: 'PROMPT-SYNTHETIC-DO-NOT-TRANSMIT', text: 'RESPONSE-SYNTHETIC-DO-NOT-TRANSMIT'
  }});

  const message = sent.find(item => item.type === 'stream_capture');
  assert.ok(message);
  assert.equal(message.payload.response_chars, 18);
  assert.equal(message.payload.adapter_version, '0.3.0');
  assert.equal(Object.hasOwn(message.payload, 'prompt_text'), false);
  assert.equal(Object.hasOwn(message.payload, 'response_text'), false);
  assert.doesNotMatch(JSON.stringify(message.payload), /PROMPT-SYNTHETIC|RESPONSE-SYNTHETIC/);
});
