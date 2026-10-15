const API = 'http://127.0.0.1:8000';
const CHATGPT_ORIGIN = 'https://chatgpt.com';
const policyPorts = new Set();
let turnLinkWrites = Promise.resolve();
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const {installationId} = await chrome.storage.local.get('installationId');
  if (!installationId) await chrome.storage.local.set({installationId: crypto.randomUUID()});
})();

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

function captureErrorCode(error) {
  const message = String(error?.message || '');
  const status = message.match(/^HTTP (\d{3})\b/)?.[1];
  if (status) return `http_${status}`;
  if (message === 'CAPTURE_PAUSED') return 'capture_paused';
  if (message === 'INVALID_PROMPT') return 'invalid_prompt';
  return 'internal_error';
}

function isChatPage(sender) {
  try { return Boolean(sender.tab) && sender.frameId === 0 && new URL(sender.url).origin === CHATGPT_ORIGIN; }
  catch { return false; }
}

function validAttachmentObservation(item) {
  if (!Array.isArray(item?.attachments) || item.attachments.length > 20 ||
      !['observed', 'not_observed', 'unavailable'].includes(item.attachments_capture_status) ||
      typeof item.attachments_truncated !== 'boolean' ||
      (item.attachments_truncated && item.attachments_capture_status !== 'observed') ||
      (item.attachments_capture_status !== 'observed' && item.attachments.length)) return false;
  return item.attachments.every(file => {
    if (!file || !['metadata_only', 'presence_only'].includes(file.capture_status) ||
        !['selection_event', 'visible_card'].includes(file.source) ||
        (file.name !== null && (typeof file.name !== 'string' || !file.name || file.name.length > 512 ||
          /[\\/\u0000-\u001f\u007f]/.test(file.name))) ||
        (file.mime_type !== null && (typeof file.mime_type !== 'string' || file.mime_type.length > 255 ||
          !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(file.mime_type))) ||
        (file.size_bytes !== null && (!Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0))) return false;
    const hasMetadata = file.name !== null || file.mime_type !== null || file.size_bytes !== null;
    if (file.association_status !== undefined && file.association_status !== 'ambiguous') return false;
    return file.capture_status === 'presence_only' ? !hasMetadata : hasMetadata;
  });
}

async function ensureMachineKey() {
  const saved = await chrome.storage.local.get(['machinePrivateKey', 'machinePublicKey']);
  if (saved.machinePrivateKey && saved.machinePublicKey) return saved;
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicKey = {kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y};
  await chrome.storage.local.set({machinePrivateKey: privateKey, machinePublicKey: publicKey});
  return {machinePrivateKey: privateKey, machinePublicKey: publicKey};
}

async function machineHeaders(path, method, bodyText) {
  await ready;
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

async function registerAndLoadMachine() {
  await ready;
  const {installationId} = await chrome.storage.local.get('installationId');
  const {machinePublicKey} = await ensureMachineKey();
  const enrolled = await sendToApi('/v1/machines', {method: 'POST', body: JSON.stringify({installation_id: installationId,
    public_key: machinePublicKey})});
  const machine = await loadMachineAssignment();
  return machine || {...enrolled, installation_id: installationId};
}

async function loadMachineAssignment() {
  const {installationId} = await chrome.storage.local.get('installationId');
  const result = await sendToApi(`/v1/machines/${installationId}`);
  const {machinePublicKey} = await chrome.storage.local.get('machinePublicKey');
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
  const point = machinePublicKey ? new Uint8Array([4, ...decode(machinePublicKey.x), ...decode(machinePublicKey.y)]) : null;
  const fingerprint = point ? hex(new Uint8Array(await crypto.subtle.digest('SHA-256', point))) : null;
  const assignment = fingerprint === result.key_fingerprint && typeof result.person_name === 'string' && result.person_name.trim()
    ? result : null;
  await chrome.storage.session.set({machineAssignment: assignment});
  await chrome.storage.session.set({machineInfo: {...result, key_matches: fingerprint === result.key_fingerprint}});
  return assignment ? {...result, key_matches: true} : {...result, key_matches: fingerprint === result.key_fingerprint};
}

async function broadcastPolicy() {
  const {machineAssignment} = await chrome.storage.session.get('machineAssignment');
  for (const port of policyPorts) {
    try { port.postMessage({type: 'block_policy', blocked: false,
      machineAssigned: Boolean(machineAssignment?.person_name)}); }
    catch { policyPorts.delete(port); }
  }
}

async function sendToApi(path, options = {}) {
  await ready;
  const {mainApiToken: token = ''} = await chrome.storage.session.get('mainApiToken');
  const method = options.method || 'GET';
  const bodyText = options.body || '';
  const signed = method === 'POST' && (path === '/v1/stream-captures' ||
    path === '/v1/artifact-metadata' || path === '/v1/interactions' ||
    /^\/v1\/interactions\/[0-9a-f-]{36}\/response$/i.test(path));
  const signedHeaders = signed ? await machineHeaders(path, method, bodyText) : {};
  const response = await fetch(`${API}${path}`, {
    ...options,
    signal: AbortSignal.timeout(10_000),
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...signedHeaders, ...options.headers}
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}${data.detail ? `: ${data.detail}` : ''}`);
  return data;
}

async function status() {
  await ready;
  const config = await chrome.storage.local.get(['enabled', 'lastCaptures', 'lastArtifacts', 'captureDiagnostics']);
  const {installationId} = await chrome.storage.local.get('installationId');
  const {mainApiToken: token = ''} = await chrome.storage.session.get('mainApiToken');
  let {machineAssignment = null, machineInfo = null} = await chrome.storage.session.get(['machineAssignment', 'machineInfo']);
  if (token) {
    try {
      const current = await loadMachineAssignment();
      machineInfo = current;
      machineAssignment = current?.person_name && current?.key_matches ? current : null;
    } catch {}
  }
  await broadcastPolicy();
  return {enabled: config.enabled === true && Boolean(machineAssignment?.person_name), configured: Boolean(token), installationId, machineAssignment, machineInfo,
    lastCaptures: config.lastCaptures || [],
    lastArtifacts: config.lastArtifacts || [], captureDiagnostics: config.captureDiagnostics || []};
}

async function recordDiagnostic(stage, details = {}) {
  const {captureDiagnostics = []} = await chrome.storage.local.get('captureDiagnostics');
  const diagnostic = {stage, at: new Date().toISOString(), ...details};
  if (stage === 'blocker_health') {
    const retained = captureDiagnostics.filter(item => item.stage !== 'blocker_health').slice(-29);
    retained.push(diagnostic);
    await chrome.storage.local.set({captureDiagnostics: retained});
    return;
  }
  captureDiagnostics.push(diagnostic);
  await chrome.storage.local.set({captureDiagnostics: captureDiagnostics.slice(-30)});
}

function turnLinkKey(conversationUrl, turnKey) {
  try {
    const url = new URL(conversationUrl);
    if (url.origin !== CHATGPT_ORIGIN ||
        !/^\/(?:g\/[a-zA-Z0-9-]+\/)?c\/[a-zA-Z0-9-]+\/?$/.test(url.pathname) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(turnKey || '')) return null;
    return `${url.pathname}:${turnKey}`;
  } catch { return null; }
}

async function rememberTurnLink(key, interactionId, promptHash) {
  const write = turnLinkWrites.then(async () => {
    const {turnLinks = []} = await chrome.storage.local.get('turnLinks');
    const entries = Array.isArray(turnLinks) ? turnLinks.filter(item =>
      Array.isArray(item) && typeof item[0] === 'string' && /^[0-9a-f-]{36}$/i.test(item[1] || '') &&
      /^[0-9a-f]{64}$/i.test(item[2] || '') && item[0] !== key) : [];
    entries.push([key, interactionId, promptHash]);
    await chrome.storage.local.set({turnLinks: entries.slice(-500)});
  });
  turnLinkWrites = write.catch(() => {});
  await write;
}

async function updateProbeConfig(enabled) {
  const tabs = await chrome.tabs.query({url: `${CHATGPT_ORIGIN}/*`});
  await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(tab =>
    chrome.tabs.sendMessage(tab.id, {type: 'probe_config', enabled})
  ));
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  (async () => {
    await ready;
    const popup = sender.url === chrome.runtime.getURL('src/popup/popup.html');
    const page = isChatPage(sender);

    if (popup && message.type === 'status') return status();
    if (popup && message.type === 'save') {
      if (typeof message.token !== 'string') throw new Error('Token inválido.');
      const suppliedToken = message.token.trim();
      const {mainApiToken: currentToken = ''} = await chrome.storage.session.get('mainApiToken');
      if (suppliedToken && suppliedToken.length < 24) throw new Error('O token precisa ter pelo menos 24 caracteres.');
      if (message.enabled === true && !suppliedToken && !currentToken)
        throw new Error('Informe o LAB_API_TOKEN da API principal em backend/.env (mínimo de 24 caracteres).');
      if (suppliedToken) await chrome.storage.session.set({mainApiToken: suppliedToken});
      let enableCapture = message.enabled === true;
      if (enableCapture) {
        const assignment = await registerAndLoadMachine();
        await broadcastPolicy();
        if (!assignment.person_name || assignment.key_matches !== true) {
          await chrome.storage.local.set({enabled: false});
          await updateProbeConfig(false);
          throw new Error(`Instalação ${assignment.installation_id} cadastrada; aguardando atribuição do colaborador.`);
        }
      }
      await chrome.storage.local.set({enabled: enableCapture});
      await updateProbeConfig(enableCapture);
      return {saved: true};
    }
    if (popup && message.type === 'machine_register') {
      const assignment = await registerAndLoadMachine();
      await broadcastPolicy();
      return assignment;
    }
    if (popup && message.type === 'health') return sendToApi('/health');

    if (page && message.type === 'probe_config') {
      const config = await chrome.storage.local.get('enabled');
      return {enabled: config.enabled === true};
    }

    if (page && ['remember_turn', 'lookup_turn'].includes(message.type)) {
      const key = turnLinkKey(message.conversationUrl, message.turnKey);
      if (!key) throw new Error('Turno invÃ¡lido.');
      await turnLinkWrites;
      if (message.type === 'lookup_turn') {
        const {turnLinks = []} = await chrome.storage.local.get('turnLinks');
        const link = Array.isArray(turnLinks)
          ? [...turnLinks].reverse().find(item => Array.isArray(item) && item[0] === key) : null;
        return {interaction_id: link?.[1] || null, prompt_hash: link?.[2] || null};
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.interactionId || ''))
        throw new Error('InteraÃ§Ã£o invÃ¡lida.');
      if (!/^[0-9a-f]{64}$/i.test(message.promptHash || '')) throw new Error('Hash de prompt invÃ¡lido.');
      await rememberTurnLink(key, message.interactionId, message.promptHash);
      return {stored: true};
    }

    if (page && message.type === 'capture_prompt') {
      const {enabled} = await chrome.storage.local.get('enabled');
      const item = message.payload;
      if (enabled !== true) throw new Error('CAPTURE_PAUSED');
      if (!item || item.platform !== 'chatgpt_web' ||
          !/^[0-9a-f-]{36}$/i.test(item.client_event_id || '') ||
          typeof item.prompt?.text !== 'string' || !validAttachmentObservation(item) ||
          (!item.prompt.text && !(item.attachments_capture_status === 'observed' && item.attachments.length)) ||
          item.prompt.text.length > 100_000 ||
          (() => { try { return new URL(item.conversation?.url).origin !== CHATGPT_ORIGIN; }
            catch { return true; } })() || item.adapter_version !== '0.4.6')
        throw new Error('INVALID_PROMPT');
      const {installationId} = await chrome.storage.local.get('installationId');
      const saved = await sendToApi('/v1/interactions', {method: 'POST', body: JSON.stringify({...item,
        device_installation_id: installationId})});
      await recordDiagnostic('prompt_stored', {interaction_id: saved.interaction_id});
      return saved;
    }

    if (page && message.type === 'capture_response') {
      const {enabled} = await chrome.storage.local.get('enabled');
      const item = message.payload;
      if (enabled !== true || !/^[0-9a-f-]{36}$/i.test(message.interactionId || '') ||
          !item || !/^[0-9a-f-]{36}$/i.test(item.client_event_id || '') ||
          typeof item.text !== 'string' || !item.text || item.text.length > 100_000 ||
          !['complete', 'incomplete'].includes(item.capture_status) || item.adapter_version !== '0.4.6')
        throw new Error('Resposta inválida ou captura pausada.');
      const saved = await sendToApi(`/v1/interactions/${message.interactionId}/response`,
        {method: 'POST', body: JSON.stringify(item)});
      await recordDiagnostic('response_stored', {interaction_id: message.interactionId,
        capture_status: item.capture_status, response_chars: item.text.length});
      return saved;
    }

    if (page && message.type === 'artifact_metadata') {
      const config = await chrome.storage.local.get('enabled');
      if (config.enabled !== true) throw new Error('Captura pausada na extensão.');
      const item = message.payload;
      if (!item || typeof item.artifact_id !== 'string' || item.platform !== 'chatgpt_web' ||
          item.source !== 'download_headers' ||
          (item.file_name !== null && (typeof item.file_name !== 'string' || !item.file_name || item.file_name.length > 255 ||
            /[\\/\u0000-\u001f\u007f]/.test(item.file_name))) ||
          (item.mime_type !== null && (typeof item.mime_type !== 'string' || item.mime_type.length > 127 ||
            !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(item.mime_type))) ||
          (item.size_bytes !== null && (!Number.isSafeInteger(item.size_bytes) || item.size_bytes < 0)) ||
          (item.conversation_context != null && (!item.conversation_context ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.conversation_context.conversation_id || '') ||
            item.conversation_context.source !== 'active_route_at_request')) ||
          (item.size_source != null && !['content_length', 'unavailable'].includes(item.size_source)) ||
          typeof item.observed_at !== 'string' ||
          (item.file_name === null && item.mime_type === null && item.size_bytes === null))
        throw new Error('Metadados de artefato inválidos.');
      let saved;
      try {
        const {installationId} = await chrome.storage.local.get('installationId');
        saved = await sendToApi('/v1/artifact-metadata', {method: 'POST', body: JSON.stringify({...item,
          device_installation_id: installationId})});
      } catch (error) {
        await recordDiagnostic('artifact_metadata_rejected', {source: item.source,
          error: String(error?.message || 'Falha na API').slice(0, 180)});
        throw error;
      }
      const {lastArtifacts = []} = await chrome.storage.local.get('lastArtifacts');
      lastArtifacts.push({...saved, source: item.source, file_name: item.file_name, mime_type: item.mime_type,
        size_bytes: item.size_bytes, conversation_context: item.conversation_context || null,
        size_source: item.size_source || null, observed_at: item.observed_at});
      await chrome.storage.local.set({lastArtifacts: lastArtifacts.slice(-20)});
      await recordDiagnostic('artifact_metadata_stored', {source: item.source,
        mime_type: item.mime_type, conversation_id: item.conversation_context?.conversation_id || null,
        size_source: item.size_source});
      return saved;
    }

    if (page && message.type === 'stream_capture') {
      const item = message.payload;
      await recordDiagnostic('capture_received', {capture_status: item?.capture_status || 'invalid',
        frames: item?.frames ?? null, bytes: item?.bytes ?? null});
      const config = await chrome.storage.local.get('enabled');
      if (config.enabled !== true) throw new Error('Captura pausada na extensão.');
      if (!item || typeof item.capture_id !== 'string' ||
          !Number.isSafeInteger(item.response_chars) || item.response_chars <= 0 || item.response_chars > 100_000 ||
          Object.hasOwn(item, 'prompt_text') || Object.hasOwn(item, 'response_text') ||
          !['complete', 'incomplete'].includes(item.capture_status) ||
          typeof item.protocol_done !== 'boolean' || typeof item.reader_done !== 'boolean' ||
          typeof item.reader_aborted_after_done !== 'boolean' ||
          typeof item.truncated !== 'boolean' ||
          (item.reader_aborted_after_done && (item.reader_done || !item.protocol_done || item.truncated)) ||
          (item.capture_status === 'complete' && (!item.protocol_done ||
            !(item.reader_done || item.reader_aborted_after_done) || item.truncated)))
        throw new Error('Snapshot de stream inválido.');
      let saved;
      try {
        const {installationId} = await chrome.storage.local.get('installationId');
        saved = await sendToApi('/v1/stream-captures', {method: 'POST', body: JSON.stringify({...item,
          device_installation_id: installationId})});
      } catch (error) {
        await recordDiagnostic('api_rejected', {error: String(error?.message || 'Falha na API').slice(0, 180)});
        throw error;
      }
      const {lastCaptures = []} = await chrome.storage.local.get('lastCaptures');
      lastCaptures.push({capture_id: item.capture_id, status: saved.status, frames: item.frames, bytes: item.bytes,
        response_chars: item.response_chars, observed_at: item.observed_at});
      await chrome.storage.local.set({lastCaptures: lastCaptures.slice(-20)});
      await recordDiagnostic('sqlite_stored', {capture_status: item.capture_status, frames: item.frames, bytes: item.bytes,
        reader_aborted_after_done: item.reader_aborted_after_done});
      return saved;
    }
    if (page && message.type === 'probe_event') {
      const item = message.payload;
      const phases = new Set(['start', 'end', 'stream_summary', 'stream_error']);
      if (!item || !phases.has(item.phase) || item.path !== '/backend-api/f/conversation')
        throw new Error('Diagnóstico de sonda inválido.');
      const numbers = ['status', 'bytes', 'chunks', 'frames', 'done_markers', 'stream_elapsed_ms',
        'assistant_messages', 'text_part_snapshots', 'text_chars', 'delta_chars', 'patch_chars'];
      const details = Object.fromEntries(numbers.filter(key => Number.isSafeInteger(item[key]) && item[key] >= 0)
        .map(key => [key, item[key]]));
      details.method = item.method === 'POST' ? 'POST' : 'other';
      details.content_kind = ['event_stream', 'json', 'other', 'none'].includes(item.content_kind)
        ? item.content_kind : 'unknown';
      details.has_body = item.has_body === true;
      details.reader_aborted_after_done = item.reader_aborted_after_done === true;
      details.event_types = Array.isArray(item.event_types) ? item.event_types.slice(0, 8) : [];
      details.event_shapes = Array.isArray(item.event_shapes) ? item.event_shapes.slice(0, 8) : [];
      details.event_keys = Array.isArray(item.event_keys) ? item.event_keys.slice(0, 8) : [];
      details.patch_shapes = Array.isArray(item.patch_shapes) ? item.patch_shapes.slice(0, 8) : [];
      details.delta_shapes = Array.isArray(item.delta_shapes) ? item.delta_shapes.slice(0, 8) : [];
      if (item.error_kind) details.error_kind = String(item.error_kind).slice(0, 40);
      await recordDiagnostic(`network_${item.phase}`, details);
      return {logged: true};
    }
    if (page && message.type === 'prompt_decision') {
      const actions = new Set(['ALLOW', 'WARN', 'REVIEW', 'BLOCK']);
      const rules = new Set(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'LIMIT', 'ENGINE', 'MANUAL', 'MACHINE', 'SYNC']);
      const methods = new Set(['click', 'enter', 'submit', 'regenerate']);
      if (message.version !== '0.1.2' || message.destination !== 'not_approved' || !actions.has(message.action) ||
          !methods.has(message.method) || !Array.isArray(message.findings) || message.findings.length > 12 ||
          !message.findings.every(item => rules.has(item.rule) && actions.has(item.action) &&
            Number.isSafeInteger(item.count) && item.count >= 1 && item.count <= 100))
        throw new Error('Decisão de política inválida.');
      await recordDiagnostic('policy_decision', {action: message.action, method: message.method,
        findings: message.findings.map(({rule, action, count}) => ({rule, action, count}))});
      return {logged: true};
    }
    if (page && message.type === 'blocker_health') {
      if (typeof message.mainActive !== 'boolean' || typeof message.blocked !== 'boolean')
        throw new Error('Estado do bloqueio inválido.');
      await recordDiagnostic('blocker_health', {main_active: message.mainActive,
        machine_assigned: message.synchronized === true && message.blocked === false,
        network_gate_blocked: message.mainBlocked === true});
      return {logged: true};
    }
    if (page && message.type === 'prompt_blocked') {
      if (!['click', 'enter', 'submit', 'network'].includes(message.method)) throw new Error('Método inválido.');
      await recordDiagnostic('prompt_blocked', {method: message.method,
        reason: ['expired', 'missing'].includes(message.reason) ? message.reason : null});
      return {blocked: true};
    }
    throw new Error('Origem ou operação inválida.');
  })().then(data => reply({ok: true, data})).catch(async error => {
    if (message?.type === 'capture_prompt' && isChatPage(sender)) {
      try { await recordDiagnostic('prompt_rejected', {error_code: captureErrorCode(error)}); } catch {}
    }
    reply({ok: false, error: String(error?.message || 'Falha na POC').slice(0, 240)});
  });
  return true;
});

chrome.runtime.onConnect.addListener(port => {
  let validPage = false;
  try { validPage = port.name === 'prompt-block-policy' && port.sender?.tab && port.sender.frameId === 0 &&
    new URL(port.sender.url).origin === CHATGPT_ORIGIN; } catch {}
  if (!validPage) { port.disconnect(); return; }
  policyPorts.add(port);
  port.onDisconnect.addListener(() => policyPorts.delete(port));
  port.onMessage.addListener(async message => {
    if (message?.type !== 'block_status') return;
    try {
      port.postMessage({type: 'block_policy', blocked: false, machineAssigned: false});
      const assignment = await loadMachineAssignment();
      port.postMessage({type: 'block_policy', blocked: false,
        machineAssigned: Boolean(assignment?.person_name && assignment?.key_matches === true)});
    } catch {
      try { port.postMessage({type: 'block_policy', blocked: false, machineAssigned: false}); } catch { policyPorts.delete(port); }
    }
  });
});
