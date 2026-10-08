const API = 'http://127.0.0.1:8000';
const platforms = new Map([['https://chatgpt.com', 'chatgpt_web'], ['https://claude.ai', 'claude_web']]);
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const {installationId} = await chrome.storage.local.get('installationId');
  if (!installationId) await chrome.storage.local.set({installationId: crypto.randomUUID()});
})();

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const unbase64url = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')
  .padEnd(Math.ceil(value.length / 4) * 4, '=')), char => char.charCodeAt(0));
async function ensureMachineKey() {
  const saved = await chrome.storage.local.get(['machinePrivateKey', 'machinePublicKey']);
  if (saved.machinePrivateKey && saved.machinePublicKey) return saved;
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const machinePrivateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const machinePublicKey = {kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y};
  await chrome.storage.local.set({machinePrivateKey, machinePublicKey});
  return {machinePrivateKey, machinePublicKey};
}
async function machineHeaders(path, method, bodyText) {
  const {installationId} = await chrome.storage.local.get('installationId');
  const {machinePrivateKey} = await ensureMachineKey();
  const key = await crypto.subtle.importKey('jwk', machinePrivateKey,
    {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bodyText))));
  const signed = `${method}\n${path}\n${timestamp}\n${nonce}\n${digest}`;
  const signatureBytes = new Uint8Array(await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key,
    new TextEncoder().encode(signed)));
  const signature = btoa(String.fromCharCode(...signatureBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return {'X-Machine-Id': installationId, 'X-Machine-Timestamp': timestamp,
    'X-Machine-Nonce': nonce, 'X-Machine-Signature': signature};
}
async function request(path, method = 'GET', body, signed = false) {
  const {token} = await chrome.storage.session.get('token');
  if (path !== '/health' && !token) throw new Error('Token ausente');
  const bodyText = body ? JSON.stringify(body) : '';
  const signedHeaders = signed ? await machineHeaders(path, method, bodyText) : {};
  const response = await fetch(API + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...signedHeaders},
    ...(body ? {body: bodyText} : {})
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function dispatch(message, sender) {
  await ready;
  const popup = !sender.tab && sender.url === chrome.runtime.getURL('src/popup/diagnostics.html');
  const page = sender.tab && sender.frameId === 0 && platforms.has(new URL(sender.url).origin);
  if (!popup && !page) throw new Error('Origem inválida');
  const config = await chrome.storage.local.get(['installationId', 'account', 'enabled', 'blockPrompts']);
  const {token, machineAssignment} = await chrome.storage.session.get(['token', 'machineAssignment']);
  if (message.type === 'status') return {...config, enabled: Boolean(config.enabled && token && machineAssignment?.personName),
    captureRequested: Boolean(config.enabled),
    authenticated: Boolean(token), machineAssignment: machineAssignment || null,
    api: API, policyVersion: '0.1.2', destination: 'not_approved'};
  if (popup && message.type === 'machine_register') {
    const {machinePublicKey} = await ensureMachineKey();
    const registered = await request('/v1/machines', 'POST',
      {installation_id: config.installationId, public_key: machinePublicKey});
    await loadMachineAssignment();
    const {blockPrompts = false} = await chrome.storage.local.get('blockPrompts');
    await broadcastPolicy(blockPrompts);
    return registered;
  }
  if (popup && message.type === 'save_blocking') {
    if (typeof message.blocked !== 'boolean') throw new Error('Regra inválida');
    await chrome.storage.local.set({blockPrompts: message.blocked});
    await broadcastPolicy(message.blocked);
    log('policy', message.blocked ? 'block' : 'allow');
    return {blocked: message.blocked};
  }
  if (popup && message.type === 'save') {
    if (typeof message.account !== 'string' || message.account.length > 320) throw new Error('Conta inválida');
    if (typeof message.token !== 'string') throw new Error('Token inválido');
    const suppliedToken = message.token.trim();
    if (suppliedToken && suppliedToken.length < 24) throw new Error('Informe um token de laboratório válido');
    if (message.enabled && !suppliedToken && !token) throw new Error('Informe o token de laboratório após recarregar a extensão');
    await chrome.storage.local.set({account: message.account, enabled: Boolean(message.enabled)});
    if (suppliedToken) await chrome.storage.session.set({token: suppliedToken});
    if (suppliedToken || token) await loadMachineAssignment();
    const {blockPrompts = false} = await chrome.storage.local.get('blockPrompts');
    await broadcastPolicy(blockPrompts);
    return {saved: true};
  }
  if (popup && message.type === 'health') return request('/health');
  if (popup && message.type === 'diagnostics') return chrome.storage.session.get('events');
  if (page && message.type === 'prompt_decision') {
    const actions = new Set(['ALLOW', 'WARN', 'REVIEW', 'BLOCK']);
    const rules = new Set(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'LIMIT', 'ENGINE', 'MANUAL', 'MACHINE']);
    const methods = new Set(['click', 'enter', 'submit']);
    if (message.version !== '0.1.2' || message.destination !== 'not_approved' ||
        !actions.has(message.action) || !methods.has(message.method) ||
        !(rules.has(message.primaryRule) || (message.primaryRule === 'NONE' && message.action === 'ALLOW')) ||
        !Array.isArray(message.findings) || message.findings.length > 12 ||
        !message.findings.every(item => rules.has(item.rule) && actions.has(item.action) &&
          Number.isSafeInteger(item.count) && item.count >= 1 && item.count <= 100) ||
        (message.primaryRule !== 'NONE' && !message.findings.some(item => item.rule === message.primaryRule))) {
      throw new Error('Decisão inválida');
    }
    const summary = message.findings.map(item => `${item.rule}:${item.count}`).join(',') || '-';
    log('decision', `${message.action} method=${message.method} policy=0.1.2 destination=not_approved primary=${message.primaryRule} rules=${summary}`);
    return {logged: true};
  }
  if (page && message.type === 'observer_health') {
    if (typeof message.editor_found !== 'boolean' || typeof message.send_found !== 'boolean' ||
        !Number.isInteger(message.editable_count) || message.editable_count < 0 || message.editable_count > 1000)
      throw new Error('Diagnóstico inválido');
    log('observer', `platform=${platforms.get(new URL(sender.url).origin)} editor=${message.editor_found ? 'found' : 'missing'} send=${message.send_found ? 'found' : 'missing'} editables=${message.editable_count}`);
    return {logged: true};
  }
  if (page && message.type === 'blocker_health') {
    if (typeof message.mainActive !== 'boolean' || typeof message.blocked !== 'boolean')
      throw new Error('Estado do bloqueio inválido');
    log('blocker', `tab=${sender.tab.id} main=${message.mainActive ? 'active' : 'missing'} manual=${message.blocked ? 'on' : 'off'} gate=${!message.mainActive ? '?' : message.mainBlocked === true ? 'closed' : 'open'}`);
    return {logged: true};
  }
  if (page && message.type === 'prompt_blocked') {
    const methods = new Set(['click', 'enter', 'submit', 'network']);
    if (!methods.has(message.method)) throw new Error('Método inválido');
    const reason = message.method === 'network' && ['expired', 'missing'].includes(message.reason)
      ? `:${message.reason}` : '';
    log('prompt', `blocked:${message.method}${reason}`);
    return {blocked: true};
  }
  if (!page || !config.enabled || !token) throw new Error('Captura pausada');
  if (message.type === 'prompt') {
    const p = message.payload;
    if (!p || typeof p.prompt?.text !== 'string' || p.prompt.text.length > 100000) throw new Error('Prompt inválido');
    const result = await request('/v1/interactions', 'POST', {
      ...p, schema_version: '0.1', platform: platforms.get(new URL(sender.url).origin), attachments: p.attachments || [],
      device_installation_id: config.installationId, account_label: config.account || null, adapter_version: '0.6.13'
    }, true);
    if (!/^[0-9a-f-]{36}$/i.test(result.interaction_id)) throw new Error('Confirmação inválida');
    await chrome.storage.session.set({[`binding:${result.interaction_id}`]: sender.documentId});
    return result;
  }
  if (message.type === 'response' && /^[0-9a-f-]{36}$/i.test(message.id)) {
    const key = `binding:${message.id}`;
    const binding = await chrome.storage.session.get(key);
    if (!sender.documentId || binding[key] !== sender.documentId) throw new Error('Vínculo inválido');
    const result = await request(`/v1/interactions/${message.id}/response`, 'POST', message.payload, true);
    await chrome.storage.session.remove(key);
    return result;
  }
  if (message.type === 'capture_failed' && /^[0-9a-f-]{36}$/i.test(message.id)) {
    const key = `binding:${message.id}`;
    const binding = await chrome.storage.session.get(key);
    if (!sender.documentId || binding[key] !== sender.documentId) throw new Error('Vínculo inválido');
    await chrome.storage.session.remove(key);
    const reasons = new Set(['no_text', 'new_prompt', 'navigation', 'timeout_no_text', 'interrupted', 'pagehide']);
    const reason = reasons.has(message.reason) ? message.reason : 'no_text';
    const diagnostics = message.diagnostics || {};
    const count = value => Number.isInteger(value) && value >= 0 && value <= 100000 ? value : '?';
    const flag = value => value === true ? '1' : value === false ? '0' : '?';
    const details = `assistants=${count(diagnostics.assistant_count)}, users=${count(diagnostics.user_count)}, after_user=${count(diagnostics.answers_after_user)}, last_user_matches=${flag(diagnostics.last_user_matches)}, latest_assistant_chars=${count(diagnostics.latest_assistant_chars)}, baseline=${count(diagnostics.baseline_count)}, streaming=${flag(diagnostics.saw_streaming)}, route_changed=${flag(diagnostics.route_changed)}, markdown=${count(diagnostics.markdown_count)}, last_markdown_chars=${count(diagnostics.latest_markdown_chars)}, articles=${count(diagnostics.article_count)}, last_article_chars=${count(diagnostics.latest_article_chars)}, turns=${count(diagnostics.turn_count)}, alt_assistants=${count(diagnostics.alt_assistant_count)}, main_chars=${count(diagnostics.main_chars)}, iframes=${count(diagnostics.iframe_count)}, search_units=${count(diagnostics.search_units)}, assistant_blocks=${count(diagnostics.assistant_blocks)}`;
    log('response', `capture_failed:${reason} [${details}]`, message.id);
    return {interaction_id: message.id, status: 'capture_failed'};
  }
  throw new Error('Operação inválida');
}

let logging = Promise.resolve();
const policyPorts = new Set();
async function loadMachineAssignment() {
  const {installationId} = await chrome.storage.local.get('installationId');
  let assignment = null;
  try {
    const result = await request(`/v1/machines/${installationId}`);
    const {machinePublicKey} = await chrome.storage.local.get('machinePublicKey');
    const point = machinePublicKey ? new Uint8Array([4, ...unbase64url(machinePublicKey.x),
      ...unbase64url(machinePublicKey.y)]) : null;
    const fingerprint = point ? hex(new Uint8Array(await crypto.subtle.digest('SHA-256', point))) : null;
    if (fingerprint === result.key_fingerprint &&
        typeof result.person_name === 'string' && result.person_name.trim()) {
      assignment = {personName: result.person_name, keyFingerprint: result.key_fingerprint};
    }
  } catch { /* Sem vínculo confirmado, a barreira local permanece fechada. */ }
  await chrome.storage.session.set({machineAssignment: assignment});
  return assignment;
}
async function broadcastPolicy(blocked) {
  const {machineAssignment} = await chrome.storage.session.get('machineAssignment');
  for (const port of policyPorts) {
    try { port.postMessage({type: 'block_policy', blocked,
      machineAssigned: Boolean(machineAssignment?.personName)}); }
    catch { policyPorts.delete(port); }
  }
}
function log(type, result, id) {
  logging = logging.then(async () => {
    const {events = []} = await chrome.storage.session.get('events');
    events.push({type, result, id: id || null, at: new Date().toISOString()});
    await chrome.storage.session.set({events: events.slice(-100)});
  }).catch(() => {});
}
function responseLogResult(status, message) {
  const result = `confirmed:${status}`;
  if (status !== 'incomplete') return result;
  const reasons = new Set(['no_text', 'new_prompt', 'navigation', 'timeout_no_text', 'interrupted', 'pagehide']);
  const reason = reasons.has(message.reason) ? message.reason : 'unknown';
  if (reason !== 'new_prompt') return `${result} reason=${reason}`;
  const evidence = message.evidence || {};
  const flag = value => value === true ? '1' : value === false ? '0' : '?';
  const count = Number.isInteger(evidence.answer_chars) && evidence.answer_chars >= 0 && evidence.answer_chars <= 1000000
    ? evidence.answer_chars : '?';
  return `${result} reason=new_prompt stop=${flag(evidence.stop)} ready=${flag(evidence.ready)} ` +
    `ambiguous=${flag(evidence.ambiguous)} seen_streaming=${flag(evidence.seen_streaming)} ` +
    `seen_stop=${flag(evidence.seen_stop)} controls=${flag(evidence.answer_controls)} chars=${count}`;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  dispatch(message, sender).then(data => {
    if (message.type === 'prompt') log('prompt', 'confirmed', data.interaction_id);
    if (message.type === 'response') log('response', responseLogResult(data.status, message), data.interaction_id);
    reply({ok: true, data});
  }).catch(error => {
    const detail = String(error?.message || '');
    const code = /^HTTP \d{3}$/.test(detail) ? detail
      : detail === 'Token ausente' ? detail
      : detail === 'Vínculo inválido' ? detail
      : error?.name === 'TimeoutError' ? 'Tempo de resposta da API esgotado'
      : detail === 'Failed to fetch' ? 'API local inacessível'
      : 'Falha ou entrega sem confirmação';
    log(message?.type, code);
    reply({ok: false, error: code});
  });
  return true;
});
chrome.runtime.onConnect.addListener(port => {
  let page = false;
  try { page = port.name === 'prompt-block-policy' && port.sender?.tab &&
    port.sender.frameId === 0 && platforms.has(new URL(port.sender.url).origin); }
  catch { /* conexão inválida */ }
  if (!page) { port.disconnect(); return; }
  policyPorts.add(port);
  port.onDisconnect.addListener(() => policyPorts.delete(port));
  port.onMessage.addListener(async message => {
    if (message?.type !== 'block_status') return;
    await ready;
    const {blockPrompts = false} = await chrome.storage.local.get('blockPrompts');
    const machine = await loadMachineAssignment();
    try { port.postMessage({type: 'block_policy', blocked: blockPrompts,
      machineAssigned: Boolean(machine?.personName)}); }
    catch { policyPorts.delete(port); }
  });
});
