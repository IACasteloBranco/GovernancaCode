import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const mainSource = await readFile(new URL('../src/content/blocker-main.js', import.meta.url), 'utf8');
const bridgeSource = await readFile(new URL('../src/content/blocker-bridge.js', import.meta.url), 'utf8');
const policySource = await readFile(new URL('../src/content/policy-engine.js', import.meta.url), 'utf8');
const messagesSource = await readFile(new URL('../src/content/policy-messages.js', import.meta.url), 'utf8');

for (const [origin, endpoint] of [['https://chatgpt.com', '/backend-api/abc/conversation'],
  ['https://claude.ai', '/api/organizations/org/chat_conversations/chat/completion']]) {
test(`${origin}: bloqueio de rede exige permissão de uso único`, async () => {
  const calls = [];
  const messages = [];
  const attrs = new Map([['data-governanca-block-prompts', 'block']]);
  const root = {getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key)};
  const window = {
    fetch: (...args) => { calls.push(args); return Promise.resolve({ok: true}); },
    postMessage: message => messages.push(message), addEventListener: () => {}
  };
  runInNewContext(mainSource, {window, document: {documentElement: root},
    location: {href: origin + '/', origin},
    URL, Symbol, Proxy, Reflect, Promise, DOMException});
  await assert.rejects(window.fetch(endpoint, {method: 'POST'}), {name: 'AbortError'});
  assert.equal(calls.length, 0);
  assert.equal(messages[0].phase, 'network_blocked');
  await window.fetch('/backend-api/conversation/abc', {method: 'POST'});
  await window.fetch(endpoint, {method: 'GET'});
  assert.equal(calls.length, 2);
  attrs.set('data-governanca-block-prompts', 'allow');
  attrs.set('data-governanca-allow-until', String(Date.now() + 15000));
  await window.fetch(endpoint, {method: 'POST'});
  assert.equal(calls.length, 3);
  assert.equal(attrs.get('data-governanca-block-prompts'), 'block');
  await assert.rejects(window.fetch(endpoint, {method: 'POST'}), {name: 'AbortError'});
  assert.equal(calls.length, 3);
});
}

test('bloqueio de eventos cobre Enter, clique e submit e libera após mudança de regra', () => {
  let captures = 0;
  const listeners = new Map();
  const messages = [];
  const toasts = [];
  const attributes = new Map();
  let policyListener;
  let disconnectListener;
  const form = {contains: () => true};
  const field = {innerText: 'Como calcular DAS?', contains: () => true, closest: () => form};
  const root = {setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: key => attributes.get(key), removeAttribute: key => attributes.delete(key), append: () => {}};
  const document = {
    documentElement: root, body: {append: () => {}},
    addEventListener: () => {}, querySelector: selector => selector === '#prompt-textarea' ? field : null,
    createElement: () => {
      const toast = {setAttribute: () => {}, style: {}, remove: () => {}};
      toasts.push(toast);
      return toast;
    }
  };
  const window = {addEventListener: (type, listener) => listeners.set(type, listener), postMessage: () => {}};
  const port = {onMessage: {addListener: listener => { policyListener = listener; }},
    onDisconnect: {addListener: listener => { disconnectListener = listener; }}, postMessage: () => {}};
  const chrome = {runtime: {connect: () => port,
    sendMessage: message => { messages.push(message); return Promise.resolve(); }}};
  const projectId = 'g-p-6abe9293e8248191ada3632b6a5316a6';
  const pageLocation = {origin: 'https://chatgpt.com', href: `https://chatgpt.com/g/${projectId}-eduardo/c/conversa`};
  runInNewContext(`${policySource}\n${messagesSource}\n${bridgeSource}`, {window, document, chrome,
    location: pageLocation, URL, Date, setTimeout: () => {}, globalThis: {GovernancaCaptureAttempt: () => { captures++; }}});
  const event = extra => ({...extra, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }});
  const enter = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(enter);
  assert.equal(enter.prevented, true);
  assert.equal(enter.stopped, true);
  assert.equal(captures, 0);
  assert.equal(messages[0].findings.some(item => item.rule === 'MACHINE'), true);
  assert.equal(messages[0].findings.some(item => item.rule === 'SYNC'), true);
  assert.equal(messages[0].findings.some(item => item.rule === 'MANUAL'), false);
  assert.match(toasts.at(-1).textContent, /sincronizando/i);
  assert.equal(attributes.get('data-governanca-block-prompts'), 'block');

  const button = {matches: () => true};
  const click = event({target: {closest: () => button}});
  listeners.get('click')(click);
  assert.equal(click.prevented, true);
  const submit = event({target: form});
  listeners.get('submit')(submit);
  assert.equal(submit.prevented, true);

  policyListener({type: 'block_policy', blocked: false, machineAssigned: false});
  const unassigned = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(unassigned);
  assert.equal(unassigned.prevented, true);
  assert.match(toasts.at(-1).textContent, /atribuída a uma pessoa/i);
  policyListener({type: 'block_policy', blocked: false, machineAssigned: true});
  assert.equal(attributes.get('data-governanca-block-prompts'), 'block');
  const allowed = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(allowed);
  assert.equal(allowed.prevented, false);
  assert.equal(captures, 1);
  assert.equal(attributes.get('data-governanca-block-prompts'), 'allow');
  assert.equal(messages[0].type, 'prompt_decision');
  disconnectListener();
  field.innerText = 'Tentativa durante reconexão';
  const disconnected = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(disconnected);
  assert.equal(disconnected.prevented, true);
  assert.match(toasts.at(-1).textContent, /sincronizando/i);
  assert.equal(messages.at(-1).findings.some(item => item.rule === 'MANUAL'), false);
  policyListener({type: 'block_policy', blocked: false, machineAssigned: true});
  field.innerText = 'Outra pergunta permitida';
  const labeledButton = {matches: () => false, type: 'button', getAttribute: name => name === 'aria-label' ? 'Enviar' : null};
  const labeledClick = event({target: {closest: () => labeledButton}});
  listeners.get('click')(labeledClick);
  assert.equal(labeledClick.prevented, false);
  pageLocation.href = 'https://chatgpt.com/g/g-p-other/project';
  field.innerText = 'Outra pergunta sintética';
  const otherProject = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(otherProject);
  assert.equal(otherProject.prevented, false);
  pageLocation.href = 'https://chatgpt.com/c/fora-de-projeto';
  field.innerText = 'Pergunta fora de projeto';
  const outsideProject = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(outsideProject);
  assert.equal(outsideProject.prevented, false);
  pageLocation.href = `https://chatgpt.com/g/${projectId}-eduardo/c/conversa`;
  field.innerText = '-----BEGIN PRIVATE KEY-----';
  const denied = event({key: 'Enter', shiftKey: false, isComposing: false, target: field});
  listeners.get('keydown')(denied);
  assert.equal(denied.prevented, true);
  assert.equal(attributes.get('data-governanca-block-prompts'), 'block');
  assert.match(toasts.at(-1).textContent, /chave privada/i);
  assert.doesNotMatch(toasts.at(-1).textContent, /BEGIN PRIVATE KEY/);
});

test('anexo visível recebe tempo para upload e mantém a barreira de uso único', () => {
  const listeners = new Map();
  const attrs = new Map();
  const root = {setAttribute: (key, value) => attrs.set(key, value),
    getAttribute: key => attrs.get(key), removeAttribute: key => attrs.delete(key)};
  const form = {contains: () => true};
  const editor = {innerText: 'Analise a imagem fictícia', contains: () => true, closest: () => form};
  const document = {documentElement: root, addEventListener: () => {},
    querySelector: selector => selector === '#prompt-textarea' ? editor : null};
  const window = {addEventListener: (type, callback) => listeners.set(type, callback), postMessage: () => {}};
  let policy;
  const port = {onMessage: {addListener: callback => { policy = callback; }},
    onDisconnect: {addListener: () => {}}, postMessage: () => {}};
  const chrome = {runtime: {connect: () => port, sendMessage: async () => ({})}};
  const now = Date.now();
  runInNewContext(`${policySource}\n${messagesSource}\n${bridgeSource}`,
    {window, document, chrome, location: {origin: 'https://claude.ai', href: 'https://claude.ai/new'},
      URL, Date, setTimeout: () => {}, globalThis: {
        GovernancaFiles: {observe: () => ({capture_status: 'observed', items: [{capture_status: 'presence_only'}]})},
        GovernancaCaptureAttempt: () => {}
      }});
  policy({type: 'block_policy', blocked: false, machineAssigned: true});
  listeners.get('keydown')({key: 'Enter', shiftKey: false, isComposing: false, target: editor});
  const expiry = Number(attrs.get('data-governanca-allow-until'));
  assert.ok(expiry >= now + 119000 && expiry <= now + 121000);
  assert.equal(attrs.get('data-governanca-block-prompts'), 'allow');
});
