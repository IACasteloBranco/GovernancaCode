import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/background/service-worker.js', import.meta.url), 'utf8'))
  .replace("import {CONFIG} from './config.js';", "const CONFIG = {mode: 'cloud', apiUrl: 'https://api.example.test', googleClientId: '123-test.apps.googleusercontent.com'};");
const redirect = 'https://test.chromiumapp.org/';
const expiry = () => Math.floor(Date.now() / 1000) + 3600;

function worker({badState = false} = {}) {
  const local = {};
  const session = {};
  const requests = [];
  let onMessage;
  let rejectApi = false;
  let invalidState = badState;
  const storage = values => ({
    async get(keys) {
      if (typeof keys === 'string') return {[keys]: values[keys]};
      return Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(values)).map(key => [key, values[key]]));
    },
    async set(update) { Object.assign(values, update); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
    async setAccessLevel() {}
  });
  const chrome = {
    storage: {local: storage(local), session: storage(session)},
    identity: {getRedirectURL: () => redirect,
      launchWebAuthFlow: async ({url, interactive}) => {
        assert.equal(interactive, true);
        const auth = new URL(url);
        requests.push({auth});
        return `${redirect}?code=synthetic-code&state=${invalidState ? 'wrong' : auth.searchParams.get('state')}`;
      }},
    tabs: {query: async () => []},
    runtime: {getURL: path => `chrome-extension://test/${path}`,
      onMessage: {addListener: listener => {onMessage = listener;}},
      onConnect: {addListener: () => {}}}
  };
  const fetch = async (url, options) => {
    requests.push({url, options});
    if (rejectApi) return {ok: false, status: 401, json: async () => ({detail: 'revoked'})};
    if (url.endsWith('/v1/auth/google-code'))
      return {ok: true, json: async () => ({id_token: 'header.payload.signature',
        sub: 'synthetic-google-sub-123', email: 'user@example.test', exp: expiry()})};
    if (url.endsWith('/v1/machines')) return {ok: true, json: async () => ({installation_id: local.installationId})};
    if (url.includes('/v1/machines/')) {
      if (!local.machinePublicKey) return {ok: true, json: async () => ({installation_id: local.installationId,
        key_fingerprint: 'pending', person_name: null, employee_id: null, department_code: null})};
      const point = Buffer.concat([Buffer.from([4]), Buffer.from(local.machinePublicKey.x, 'base64url'),
        Buffer.from(local.machinePublicKey.y, 'base64url')]);
      return {ok: true, json: async () => ({installation_id: local.installationId,
        key_fingerprint: createHash('sha256').update(point).digest('hex'), person_name: 'Pessoa Sintética',
        employee_id: 'SYN-1', department_code: 'TEST'})};
    }
    throw new Error(`Unexpected ${url}`);
  };
  vm.runInNewContext(source, {chrome, crypto: webcrypto, URL, URLSearchParams, TextEncoder,
    Uint8Array, AbortSignal, btoa, atob, fetch, console});
  const popup = {url: chrome.runtime.getURL('src/popup/popup.html')};
  const page = {tab: {id: 1}, frameId: 0, url: 'https://chatgpt.com/'};
  const send = (type, extra = {}, sender = popup) => new Promise(resolve => onMessage({type, ...extra}, sender, resolve));
  return {send, page, local, session, requests, reject: () => {rejectApi = true;},
    breakState: () => {invalidState = true;}};
}

test('Google login uses code, PKCE S256, state and exact redirect before backend exchange', async () => {
  const client = worker();
  const login = await client.send('login');
  assert.equal(login.ok, true);
  const auth = client.requests[0].auth;
  assert.equal(auth.origin, 'https://accounts.google.com');
  assert.equal(auth.searchParams.get('response_type'), 'code');
  assert.equal(auth.searchParams.get('redirect_uri'), redirect);
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(auth.searchParams.get('scope'), 'openid email');
  const exchange = client.requests[1];
  assert.equal(exchange.url, 'https://api.example.test/v1/auth/google-code');
  const body = JSON.parse(exchange.options.body);
  assert.equal(body.code, 'synthetic-code');
  assert.equal(body.redirect_uri, redirect);
  assert.equal(body.nonce, auth.searchParams.get('nonce'));
  assert.equal(auth.searchParams.get('code_challenge'), createHash('sha256').update(body.code_verifier)
    .digest('base64url'));
  assert.equal(client.session.googleSession.email, 'user@example.test');
  assert.equal(client.session.googleSession.sub, 'synthetic-google-sub-123');
  const status = await client.send('status');
  assert.equal(status.data.sub, 'synthetic-google-sub-123');
  assert.equal(JSON.stringify(status.data).includes('header.payload.signature'), false);
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, false);
});

test('a matching assigned machine remains authorized after loading its cloud assignment', async () => {
  const client = worker();
  client.local.machinePublicKey = {kty: 'EC', crv: 'P-256',
    x: Buffer.alloc(32, 1).toString('base64url'), y: Buffer.alloc(32, 2).toString('base64url')};
  assert.equal((await client.send('login')).ok, true);
  client.local.enabled = true;

  assert.equal(client.session.machineAssignment.key_matches, true);
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, true);
});

test('wrong OAuth state prevents code exchange and leaves capture closed', async () => {
  const client = worker({badState: true});
  assert.equal((await client.send('login')).ok, false);
  assert.equal(client.requests.length, 1);
  assert.equal(client.session.googleSession, undefined);
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, false);
});

test('starting a new Google login closes the previous account before account selection', async () => {
  const client = worker();
  assert.equal((await client.send('login')).ok, true);
  client.local.enabled = true;
  client.session.machineAssignment = {person_name: 'Pessoa A', employee_id: 'SYN-A',
    department_code: 'TEST', key_matches: true, subject_bound: true};
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, true);
  client.breakState();
  assert.equal((await client.send('login')).ok, false);
  assert.equal(client.session.googleSession, undefined);
  assert.equal(client.session.machineAssignment, undefined);
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, false);
});

test('expired session and API 401 close capture even with a cached assignment', async () => {
  const client = worker();
  assert.equal((await client.send('login')).ok, true);
  client.local.enabled = true;
  client.session.machineAssignment = {person_name: 'Pessoa Sintética', employee_id: 'SYN-1',
    department_code: 'TEST', key_matches: true, subject_bound: true};
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, true);
  client.session.googleSession.exp = Math.floor(Date.now() / 1000) - 1;
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, false);
  assert.equal((await client.send('machine_register')).ok, false);
  assert.equal(client.local.enabled, false);
  assert.equal(client.session.googleSession, undefined);
  assert.equal((await client.send('login')).ok, true);
  client.reject();
  assert.equal((await client.send('machine_register')).ok, false);
  assert.equal(client.session.googleSession, undefined);
  assert.equal((await client.send('probe_config', {}, client.page)).data.enabled, false);
});
