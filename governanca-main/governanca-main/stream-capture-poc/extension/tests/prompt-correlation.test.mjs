import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/network-bridge.js', import.meta.url), 'utf8');
const marker = 'governanca-ai-network-probe-v1';
const attemptId = 'a3cc6a9e-64be-44e4-a989-53dc971b5dd0';

function makeBridge(prompt) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const sent = [];
  const form = {contains: () => true};
  const field = {innerText: prompt, value: '', textContent: '', closest: () => form, contains: () => true};
  const window = {
    addEventListener: (type, callback) => windowListeners.set(type, callback),
    postMessage: data => windowListeners.get('message')?.({source: window, origin: 'https://chatgpt.com', data})
  };
  const document = {
    querySelector: selector => selector === '#prompt-textarea' ? field : null,
    addEventListener: (type, callback) => documentListeners.set(type, callback)
  };
  const chrome = {runtime: {
    onMessage: {addListener: callback => { chrome.listener = callback; }},
    sendMessage: async message => {
      sent.push(message);
      return message.type === 'probe_config' ? {ok: true, data: {enabled: true}} : {ok: true, data: {}};
    }
  }};
  vm.runInNewContext(source, {window, document, chrome, location: {origin: 'https://chatgpt.com'}, Date, Map});
  chrome.listener({type: 'probe_config', enabled: true}, {}, () => {});

  function emit(payload) {
    windowListeners.get('message')({source: window, origin: 'https://chatgpt.com', data: {marker, ...payload}});
  }
  function clickSend() {
    const button = {type: 'button', matches: selector => selector === 'button[data-testid="send-button"]'};
    documentListeners.get('click')({target: {closest: () => button}});
  }
  function enterSend() {
    documentListeners.get('keydown')({key: 'Enter', shiftKey: false, isComposing: false,
      target: field, composedPath: () => [field]});
  }
  function submitSend() {
    documentListeners.get('submit')({target: form});
  }
  function start() {
    emit({transport: 'fetch', phase: 'start', attemptId, path: '/backend-api/f/conversation', method: 'POST'});
  }
  function finish() {
    emit({transport: 'fetch', phase: 'stream_capture', attemptId, path: '/backend-api/f/conversation',
      captureStatus: 'complete', protocolDone: true, readerDone: true, truncated: false,
      status: 200, contentType: 'text/event-stream', requestId: 1, text: 'Resposta sintética', bytes: 42,
      chunks: 2, frames: 3, doneMarkers: 1, streamElapsedMs: 100, eventTypes: [], eventShapes: [], eventSequence: []});
    return sent.find(message => message.type === 'stream_capture')?.payload;
  }
  function setEnabled(enabled) {
    chrome.listener({type: 'probe_config', enabled}, {}, () => {});
  }
  return {clickSend, enterSend, submitSend, start, finish, setEnabled, sent};
}

test('pairs the submitted composer text with the next conversation stream capture', () => {
  const bridge = makeBridge('Prompt sintético do usuário');
  bridge.clickSend();
  bridge.start();
  const saved = bridge.finish();
  assert.equal(saved.prompt_text, 'Prompt sintético do usuário');
  assert.equal(saved.response_text, 'Resposta sintética');
});

test('captures prompt submission by Enter and form submit', () => {
  for (const submit of ['enterSend', 'submitSend']) {
    const bridge = makeBridge(`Prompt via ${submit}`);
    bridge[submit]();
    bridge.start();
    assert.equal(bridge.finish().prompt_text, `Prompt via ${submit}`);
  }
});

test('does not persist a stale prompt after capture is paused', () => {
  const bridge = makeBridge('Prompt que deve ser descartado ao pausar');
  bridge.clickSend();
  bridge.setEnabled(false);
  bridge.start();
  assert.equal(bridge.finish(), undefined);
  assert.equal(bridge.sent.some(message => message.type === 'stream_capture'), false);
});
