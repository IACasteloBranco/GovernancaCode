import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const attemptId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://chatgpt.com';
const mainSource = await readFile(new URL('../src/content/network-probe-main.js', import.meta.url), 'utf8');
const bridgeSource = await readFile(new URL('../src/content/network-bridge.js', import.meta.url), 'utf8');

function mainContext(overrides = {}) {
  const events = [];
  const attributes = new Map([
    ['data-governanca-probe-attempt', attemptId],
    ['data-governanca-probe-until', String(Date.now() + 60_000)]
  ]);
  const window = {
    postMessage: (data, target) => events.push({data, target}),
    fetch: async () => ({status: 200, headers: {get: () => 'text/event-stream; charset=utf-8'}, body: {}}),
    ...overrides
  };
  runInNewContext(mainSource, {
    window, document: {documentElement: {getAttribute: key => attributes.get(key)}},
    location: {href: `${origin}/`, origin}, URL, Date, performance,
    Promise, Symbol, Proxy, Reflect, Map, Set, WeakMap, TextDecoder
  });
  return {window, events, attributes};
}

test('a sonda de fetch preserva o resultado e emite apenas metadados sem credenciais', async () => {
  const {window, events} = mainContext();
  const result = await window.fetch(`${origin}/backend-api/conversation/abc123?access_token=secret`, {
    method: 'POST', headers: {Authorization: 'Bearer secret'}, body: 'prompt-secreto'
  });
  await Promise.resolve();
  assert.equal(result.status, 200);
  assert.deepEqual(events.map(event => event.data.phase), ['start', 'end']);
  assert.equal(events[0].data.path, '/backend-api/conversation/:id');
  assert.equal(events[1].data.contentType, 'text/event-stream');
  assert.equal(events[1].data.hasBody, true);
  assert.equal(events[0].target, origin);
  assert.doesNotMatch(JSON.stringify(events), /secret|Authorization|access_token|prompt-secreto/);

  await window.fetch('https://other.example/private', {method: 'POST', body: 'secret'});
  await Promise.resolve();
  assert.equal(events.length, 2);
});

test('a sonda de fetch não consome o corpo nem altera erro da aplicação', async () => {
  const failure = new Error('falha de teste');
  const {window, events} = mainContext({fetch: () => Promise.reject(failure)});
  await assert.rejects(window.fetch('/backend-api/conversation', {method: 'POST'}), error => error === failure);
  await Promise.resolve();
  assert.deepEqual(events.map(event => event.data.phase), ['start', 'error']);
});

test('o espelho da requisição conversation resume frames sem publicar texto da resposta', async () => {
  const payload = 'event: message\ndata: {"type":"message","message":{"status":"finished_successfully","metadata":{"finish_details":{"type":"stop"}}},"content":"RESPOSTA_PRIVADA"}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(payload);
  const originalBody = {original: true};
  const response = {
    ok: true, status: 200, headers: {get: () => 'text/event-stream'}, body: originalBody,
    clone: () => ({body: new ReadableStream({start(controller) {
      controller.enqueue(bytes.subarray(0, 31));
      controller.enqueue(bytes.subarray(31));
      controller.close();
    }})})
  };
  const {window, events} = mainContext({fetch: async () => response});
  assert.equal(await window.fetch('/backend-api/conversation', {method: 'POST'}), response);
  await new Promise(resolve => setTimeout(resolve, 0));
  const summary = events.find(event => event.data.phase === 'stream_summary')?.data;
  assert.ok(summary);
  assert.equal(summary.readerDone, true);
  assert.equal(summary.doneMarkers, 1);
  assert.equal(summary.protocolDone, true);
  assert.equal(summary.chunks, 2);
  assert.equal(summary.frames, 2);
  assert.equal(summary.eventSequence.length, 2);
  assert.equal(summary.eventSequence[1], 'message--unparsed');
  assert.equal(response.body, originalBody);
  assert.doesNotMatch(JSON.stringify(events), /RESPOSTA_PRIVADA/);
});

test('reconstrói somente snapshot final de texto do assistente após [DONE]', async () => {
  const event = {type: 'message', message: {author: {role: 'assistant'}, status: 'finished_successfully',
    metadata: {finish_details: {type: 'stop'}}, content: {parts: ['Resposta ', 'sintética QA-NETWORK-CAPTURE']}}};
  const payload = `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(payload);
  const response = {ok: true, status: 200, headers: {get: () => 'text/event-stream'}, body: {},
    clone: () => ({body: new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }})})};
  const {window, events} = mainContext({fetch: async () => response});
  await window.fetch('/backend-api/conversation', {method: 'POST'});
  await new Promise(resolve => setTimeout(resolve, 0));
  const capture = events.find(item => item.data.phase === 'stream_capture')?.data;
  assert.equal(capture.text, 'Resposta sintética QA-NETWORK-CAPTURE');
  assert.equal(capture.protocolDone, true);
  assert.equal(capture.path, '/backend-api/conversation');
});

test('um erro de leitura após [DONE] ainda pode entregar o snapshot final verificado', async () => {
  const event = {message: {author: {role: 'assistant'}, status: 'finished_successfully',
    metadata: {finish_details: {type: 'stop'}}, content: {parts: ['Resposta após done']}}};
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`);
  let reads = 0;
  const response = {ok: true, status: 200, headers: {get: () => 'text/event-stream'}, body: {},
    clone: () => ({body: {getReader: () => ({read: () => reads++ === 0
      ? Promise.resolve({done: false, value: bytes})
      : Promise.reject(Object.assign(new Error('abort'), {name: 'AbortError'}))})}})};
  const {window, events} = mainContext({fetch: async () => response});
  await window.fetch('/backend-api/conversation', {method: 'POST'});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(events.find(item => item.data.phase === 'stream_capture')?.data.text, 'Resposta após done');
  assert.equal(events.find(item => item.data.phase === 'stream_error')?.data.protocolDone, true);
});

test('não reconstrói resposta sem marcador [DONE] ou sinal de conclusão do assistente', async () => {
  const event = {type: 'message', message: {author: {role: 'assistant'}, status: 'in_progress',
    content: {parts: ['Resposta parcial']}}};
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
  const response = {ok: true, status: 200, headers: {get: () => 'text/event-stream'}, body: {},
    clone: () => ({body: new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }})})};
  const {window, events} = mainContext({fetch: async () => response});
  await window.fetch('/backend-api/conversation', {method: 'POST'});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(events.some(item => item.data.phase === 'stream_capture'), false);
});

test('erro de leitura mantém os eventos observados e registra somente a classe do erro', async () => {
  const bytes = new TextEncoder().encode('event: message\ndata: {"type":"message","content":"PRIVADO"}\n\ndata: [DONE]\n\n');
  let reads = 0;
  const response = {
    ok: true, status: 200, headers: {get: () => 'text/event-stream'}, body: {},
    clone: () => ({body: {getReader: () => ({read: () => {
      if (reads++ === 0) return Promise.resolve({done: false, value: bytes});
      return Promise.reject(Object.assign(new Error('mensagem interna privada'), {name: 'AbortError'}));
    }})}})
  };
  const {window, events} = mainContext({fetch: async () => response});
  await window.fetch('/backend-api/conversation', {method: 'POST'});
  await new Promise(resolve => setTimeout(resolve, 0));
  const failure = events.find(event => event.data.phase === 'stream_error')?.data;
  assert.ok(failure);
  assert.equal(failure.errorKind, 'AbortError');
  assert.equal(failure.frames, 2);
  assert.equal(failure.readerDone, false);
  assert.equal(failure.protocolDone, true);
  assert.equal(failure.doneMarkers, 1);
  assert.ok(failure.eventTypes.includes('message:message=1'));
  assert.ok(failure.eventShapes.includes('keys-type_content=1'));
  assert.equal(failure.eventSequence.length, 2);
  assert.doesNotMatch(JSON.stringify(events), /PRIVADO|mensagem interna privada/);
});

test('a ponte aceita somente origem e campos previstos', async () => {
  let listener;
  const messages = [];
  const window = {addEventListener: (_name, callback) => { listener = callback; }};
  const chrome = {runtime: {sendMessage: message => { messages.push(message); return Promise.resolve(); }}};
  runInNewContext(bridgeSource, {window, chrome, location: {origin}, Set, Map, Number});
  const data = {
    marker: 'governanca-ai-network-probe-v1', attemptId, transport: 'fetch', phase: 'end',
    path: '/backend-api/conversation', method: 'POST', requestId: 2, status: 200,
    contentType: 'text/event-stream', secret: 'não encaminhar'
  };
  listener({source: window, origin: 'https://other.example', data});
  listener({source: window, origin, data: {...data, path: '/backend-api/conversation?secret=123'}});
  assert.equal(messages.length, 0);
  listener({source: window, origin, data});
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'probe_metadata');
  assert.equal(messages[0].secret, undefined);
  assert.doesNotMatch(JSON.stringify(messages), /não encaminhar/);
});

test('a ponte isola o texto reconstruído para o observador, sem enviá-lo ao log da sonda', () => {
  let listener;
  const customEvents = [];
  const window = {addEventListener: (_name, callback) => { listener = callback; },
    dispatchEvent: event => customEvents.push(event)};
  const chrome = {runtime: {sendMessage: () => Promise.resolve()}};
  class FakeCustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  runInNewContext(bridgeSource, {window, chrome, location: {origin}, Set, Map, Number, CustomEvent: FakeCustomEvent});
  const data = {marker: 'governanca-ai-network-probe-v1', attemptId, transport: 'fetch', phase: 'stream_capture',
    path: '/backend-api/conversation', requestId: 4, protocolDone: true, text: 'Resposta sintética'};
  listener({source: window, origin, data});
  assert.equal(customEvents.length, 1);
  assert.equal(customEvents[0].type, 'governanca-ai-network-capture');
  assert.deepEqual(JSON.parse(JSON.stringify(customEvents[0].detail)), {attemptId, text: 'Resposta sintética', requestId: 4, protocolDone: true});
});
