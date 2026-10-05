import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const source = await readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8');

test('popup altera bloqueio sem token e a regra chega à aba conectada', async () => {
  const local = new Map();
  const session = new Map();
  let connectListener;
  let portListener;
  const posted = [];
  const store = map => ({
    setAccessLevel: async () => {},
    get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys])
      .filter(key => map.has(key)).map(key => [key, map.get(key)])),
    set: async values => { for (const [key, value] of Object.entries(values)) map.set(key, value); },
    remove: async key => map.delete(key)
  });
  const chrome = {
    storage: {local: store(local), session: store(session)},
    runtime: {
      getURL: path => `chrome-extension://test/${path}`,
      onMessage: {addListener: () => {}},
      onConnect: {addListener: listener => { connectListener = listener; }}
    }
  };
  const context = {chrome, crypto: {randomUUID: () => '11111111-1111-4111-8111-111111111111'},
    URL, Date, Set, Promise, AbortSignal};
  runInNewContext(`${source}\nglobalThis.__dispatch = dispatch;`, context);
  const popup = {url: chrome.runtime.getURL('src/popup/diagnostics.html')};
  const page = {tab: {id: 7}, frameId: 0, url: 'https://chatgpt.com/c/test'};
  const port = {name: 'prompt-block-policy', sender: page,
    postMessage: message => posted.push(message),
    onMessage: {addListener: listener => { portListener = listener; }},
    onDisconnect: {addListener: () => {}}};
  connectListener(port);
  await portListener({type: 'block_status'});
  assert.equal(posted.at(-1).blocked, false);
  await context.__dispatch({type: 'save_blocking', blocked: true}, popup);
  assert.equal(local.get('blockPrompts'), true);
  assert.equal(posted.at(-1).blocked, true);
  const status = await context.__dispatch({type: 'status'}, page);
  assert.equal(status.blockPrompts, true);
  assert.equal((await context.__dispatch({type: 'blocker_health', mainActive: true,
    blocked: true, mainBlocked: true}, page)).logged, true);
  assert.equal((await context.__dispatch({type: 'prompt_decision', action: 'BLOCK', version: '0.1.2',
    destination: 'not_approved', method: 'enter', primaryRule: 'R01',
    findings: [{rule: 'R01', action: 'BLOCK', count: 1}]}, page)).logged, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(JSON.stringify(session.get('events')), /decision.*BLOCK.*R01/);
  assert.doesNotMatch(JSON.stringify(session.get('events')), /PRIVATE KEY|prompt text/);
  await context.__dispatch({type: 'save_blocking', blocked: false}, popup);
  assert.equal(posted.at(-1).blocked, false);
});

for (const [origin, platform] of [['https://chatgpt.com', 'chatgpt_web'], ['https://claude.ai', 'claude_web']]) {
test(`${platform}: assina metadados e determina a plataforma pela origem`, async () => {
  const local = new Map();
  const session = new Map();
  const store = map => ({
    setAccessLevel: async () => {},
    get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys])
      .filter(key => map.has(key)).map(key => [key, map.get(key)])),
    set: async values => { for (const [key, value] of Object.entries(values)) map.set(key, value); },
    remove: async key => map.delete(key)
  });
  const chrome = {storage: {local: store(local), session: store(session)}, runtime: {
    getURL: path => `chrome-extension://test/${path}`,
    onMessage: {addListener: () => {}}, onConnect: {addListener: () => {}}
  }};
  let publicKey;
  let fingerprint;
  let verifiedSignature = false;
  let capturedBody;
  const fetch = async (url, options) => {
    let data;
    if (url.endsWith('/v1/machines') && options.method === 'POST') {
      publicKey = JSON.parse(options.body).public_key;
      const decode = value => Buffer.from(value, 'base64url');
      const point = Buffer.concat([Buffer.from([4]), decode(publicKey.x), decode(publicKey.y)]);
      fingerprint = Buffer.from(await webcrypto.subtle.digest('SHA-256', point)).toString('hex');
      data = {installation_id: local.get('installationId'), key_fingerprint: fingerprint};
    } else if (url.includes('/v1/machines/')) {
      data = {person_name: 'EDUARDO', project_id: null, key_fingerprint: fingerprint};
    } else if (url.endsWith('/v1/interactions')) {
      capturedBody = JSON.parse(options.body);
      const path = '/v1/interactions';
      const digest = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(options.body))).toString('hex');
      const signed = `POST\n${path}\n${options.headers['X-Machine-Timestamp']}\n${options.headers['X-Machine-Nonce']}\n${digest}`;
      const key = await webcrypto.subtle.importKey('jwk', publicKey, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
      verifiedSignature = await webcrypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key,
        Buffer.from(options.headers['X-Machine-Signature'], 'base64url'), new TextEncoder().encode(signed));
      data = {interaction_id: '11111111-1111-4111-8111-111111111111'};
    }
    return {ok: true, json: async () => data};
  };
  const context = {chrome, crypto: webcrypto, fetch, btoa, atob, TextEncoder, Uint8Array,
    URL, Date, Set, Promise, AbortSignal};
  runInNewContext(`${source}\nglobalThis.__dispatch = dispatch;`, context);
  const popup = {url: chrome.runtime.getURL('src/popup/diagnostics.html')};
  const page = {tab: {id: 1}, frameId: 0, url: origin + '/'};
  await context.__dispatch({type: 'save', account: 'shared@example.invalid',
    token: 'synthetic-laboratory-token-123456789', enabled: true}, popup);
  assert.equal((await context.__dispatch({type: 'status'}, page)).enabled, false);
  await context.__dispatch({type: 'machine_register'}, popup);
  assert.equal((await context.__dispatch({type: 'status'}, page)).machineAssignment.personName, 'EDUARDO');
  assert.equal((await context.__dispatch({type: 'status'}, page)).enabled, true);
  await context.__dispatch({type: 'save', account: 'shared@example.invalid', token: '', enabled: false}, popup);
  assert.equal((await context.__dispatch({type: 'status'}, page)).enabled, false);
  await context.__dispatch({type: 'save', account: 'shared@example.invalid', token: '', enabled: true}, popup);
  assert.equal((await context.__dispatch({type: 'status'}, page)).enabled, true);
  const result = await context.__dispatch({type: 'prompt', payload: {
    client_event_id: '22222222-2222-4222-8222-222222222222',
    prompt: {text: 'Prompt sintético'},
    platform: 'spoofed', attachments: [{name: 'test.csv', capture_status: 'metadata_only'}],
    attachments_capture_status: 'observed',
    project: {url: 'https://chatgpt.com/g/g-p-test123/project', capture_status: 'observed'}
  }}, page);
  assert.equal(result.interaction_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(verifiedSignature, true);
  assert.equal(capturedBody.platform, platform);
  assert.equal(capturedBody.attachments[0].name, 'test.csv');
  assert.equal(capturedBody.attachments_capture_status, 'observed');
  await assert.rejects(context.__dispatch({type: 'status'}, {...page, url: 'https://claude.ai.evil.invalid/'}), /Origem inválida/);
  assert.equal(local.get('machinePrivateKey').kty, 'EC');
});
}
