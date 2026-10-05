import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const messagesSource = await readFile(new URL('../src/content/policy-messages.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../src/popup/diagnostics.js', import.meta.url), 'utf8');

test('as mensagens explicam regra e contagem sem revelar valores do prompt', () => {
  const scope = {};
  runInNewContext(messagesSource, {globalThis: scope});
  const messages = scope.GovernancaPolicyMessages;
  const cpf = messages.describe({action: 'BLOCK', primaryRule: 'R05',
    findings: [{rule: 'R05', action: 'BLOCK', count: 5}]});
  assert.match(cpf, /5 CPFs válidos distintos/);
  assert.doesNotMatch(cpf, /90000000175/);
  const single = messages.describe({action: 'BLOCK', primaryRule: 'R05',
    findings: [{rule: 'R05', action: 'BLOCK', count: 1}]});
  assert.match(single, /CPF válido detectado/);
  assert.doesNotMatch(single, /900\.000\.001-75/);
  const pem = messages.describe({action: 'BLOCK', primaryRule: 'R01',
    findings: [{rule: 'R01', action: 'BLOCK', count: 1}]});
  assert.match(pem, /chave privada/i);
  assert.equal(messages.primary({action: 'BLOCK', findings: [
    {rule: 'R01', action: 'BLOCK', count: 1}, {rule: 'MANUAL', action: 'BLOCK', count: 1}
  ]}), 'MANUAL');
});

test('o popup destaca o motivo da última decisão registrada', async () => {
  const elements = new Map();
  const document = {getElementById: id => {
    if (!elements.has(id)) elements.set(id, {value: '', checked: false, textContent: '', addEventListener: () => {}});
    return elements.get(id);
  }};
  const chrome = {runtime: {sendMessage: async message => ({ok: true, data:
    message.type === 'status' ? {account: '', enabled: false, blockPrompts: false,
      api: 'http://127.0.0.1:8000', policyVersion: '0.1.2', destination: 'not_approved'} :
      {events: [{type: 'decision', at: '2026-09-28T00:00:00Z',
        result: 'BLOCK method=enter policy=0.1.2 destination=not_approved primary=R01 rules=R01:1'}]}
  })}};
  const scope = {};
  runInNewContext(`${messagesSource}\n${popupSource}`, {globalThis: scope, document, chrome, Number, RegExp});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(elements.get('last-decision').textContent, /chave privada/i);
  assert.doesNotMatch(elements.get('last-decision').textContent, /PRIVATE KEY-----/);
});

test('o popup diferencia scripts ausentes de editor não reconhecido', async () => {
  const elements = new Map();
  const document = {getElementById: id => {
    if (!elements.has(id)) elements.set(id, {value: '', checked: false, textContent: '', addEventListener: () => {}});
    return elements.get(id);
  }};
  let policy = null;
  let observer = null;
  const chrome = {runtime: {sendMessage: async message => ({ok: true, data:
    message.type === 'status' ? {enabled: true, api: 'http://127.0.0.1:8000', policyVersion: '0.1.2'} : {events: []}
  })}, tabs: {
    query: async () => [{id: 7}],
    sendMessage: async (_id, message) => message.type === 'governanca_probe_policy' ? policy : observer
  }};
  const context = {globalThis: {}, document, chrome, Number, RegExp, Promise};
  runInNewContext(`${messagesSource}\n${popupSource}\nglobalThis.__refresh = refresh;`, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(elements.get('tab-state').textContent, /Scripts ausentes/);
  policy = {active: true, platform: 'claude_web'};
  observer = {active: true, editor_found: false, send_found: false, editable_count: 1};
  await context.globalThis.__refresh();
  assert.match(elements.get('tab-state').textContent, /Editor: não encontrado/);
  assert.match(elements.get('tab-state').textContent, /Botão de envio: não encontrado/);
  observer = {...observer, editor_found: true, send_found: true};
  await context.globalThis.__refresh();
  assert.match(elements.get('tab-state').textContent, /Política e captura ativas/);
});

test('popup permite salvar com token ativo e explica token perdido na recarga', async () => {
  const elements = new Map();
  const document = {getElementById: id => {
    if (!elements.has(id)) elements.set(id, {value: '', checked: false, textContent: '', required: false, addEventListener: () => {}});
    return elements.get(id);
  }};
  let authenticated = true;
  const chrome = {runtime: {sendMessage: async message => ({ok: true, data:
    message.type === 'status' ? {enabled: authenticated, captureRequested: true,
      authenticated, machineAssignment: authenticated ? {personName: 'EDUARDO'} : null,
      api: 'http://127.0.0.1:8000', policyVersion: '0.1.2'} : {events: []}
  })}};
  const context = {globalThis: {}, document, chrome, Number, RegExp, Promise};
  runInNewContext(`${messagesSource}\n${popupSource}\nglobalThis.__refresh = refresh;`, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('token').required, false);
  assert.equal(elements.get('enabled').checked, true);
  authenticated = false;
  await context.globalThis.__refresh();
  assert.equal(elements.get('token').required, true);
  assert.equal(elements.get('enabled').checked, true);
  assert.match(elements.get('identity').textContent, /informe o token/);
});
