import {CONFIG} from './config.js';

const CLOUD = CONFIG.mode !== 'local';
const API = CLOUD ? CONFIG.apiUrl.replace(/\/$/, '') : 'http://127.0.0.1:8000';
const CHATGPT_ORIGIN = 'https://chatgpt.com';
const BLOCKER_PROTOCOL_VERSION = 1; // Bump only for incompatible blocker-message changes.
const PRIVACY_NOTICE_VERSION = '2026-10-22.1';
const LOCAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const policyPorts = new Set();
const policyPortProtocols = new WeakMap();
let localHistoryWrites = Promise.resolve();
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const {captureApiToken, mainApiToken} = await chrome.storage.session.get(['captureApiToken', 'mainApiToken']);
  if (!captureApiToken && mainApiToken) await chrome.storage.session.set({captureApiToken: mainApiToken});
  if (mainApiToken) await chrome.storage.session.remove('mainApiToken');
  const {installationId} = await chrome.storage.local.get('installationId');
  if (!installationId) await chrome.storage.local.set({installationId: crypto.randomUUID()});
  await chrome.alarms?.create?.('privacy-retention-cleanup', {periodInMinutes: 24 * 60});
  await pruneLocalHistory();
})();

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function cloudConfigured() {
  try {
    const url = new URL(API);
    return CLOUD && url.protocol === 'https:' && url.origin === API && !url.username && !url.password &&
      /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(CONFIG.googleClientId);
  } catch { return false; }
}

async function credentials() {
  if (CLOUD) {
    const {googleSession} = await chrome.storage.session.get('googleSession');
    return googleSession?.id_token && Number.isSafeInteger(googleSession.exp) &&
      googleSession.exp * 1000 > Date.now() ? googleSession : null;
  }
  const {captureApiToken} = await chrome.storage.session.get('captureApiToken');
  return captureApiToken ? {id_token: captureApiToken} : null;
}

async function captureReadiness() {
  const [{enabled, privacyAcceptance}, {machineAssignment, googleSession}] = await Promise.all([
    chrome.storage.local.get(['enabled', 'privacyAcceptance']),
    chrome.storage.session.get(['machineAssignment', 'googleSession'])]);
  const configured = !CLOUD || cloudConfigured();
  const authSessionValid = Boolean(await credentials());
  const keyMatches = machineAssignment?.key_matches === true;
  const subjectBound = !CLOUD || machineAssignment?.subject_bound === true;
  const machineAssignmentComplete = Boolean(machineAssignment?.person_name && machineAssignment?.employee_id &&
    machineAssignment?.department_code && keyMatches && subjectBound);
  const captureEnabled = enabled === true;
  const subject = CLOUD ? googleSession?.sub : machineAssignment?.employee_id;
  const privacyNoticeAccepted = Boolean(subject && privacyAcceptance?.version === PRIVACY_NOTICE_VERSION &&
    privacyAcceptance.subject === subject && Number.isFinite(Date.parse(privacyAcceptance.accepted_at)));
  return {cloud_configured: configured, capture_enabled: captureEnabled,
    auth_session_valid: authSessionValid, machine_assignment_complete: machineAssignmentComplete,
    key_matches: keyMatches, subject_bound: subjectBound, privacy_notice_accepted: privacyNoticeAccepted,
    capture_allowed: configured && captureEnabled && authSessionValid && machineAssignmentComplete && privacyNoticeAccepted};
}

async function captureAllowed() {
  return (await captureReadiness()).capture_allowed;
}

async function closeCloudSession(reason) {
  if (!CLOUD) return;
  await chrome.storage.session.remove(['googleSession', 'machineAssignment', 'machineInfo']);
  await chrome.storage.session.set({authProblem: reason});
  await chrome.storage.local.set({enabled: false});
  await broadcastPolicy();
  await updateProbeConfig(false);
}

async function googleLogin() {
  if (!cloudConfigured()) throw new Error('Configure a URL HTTPS da API e o cliente OAuth antes do login.');
  await closeCloudSession('Login Google em andamento.');
  const redirect_uri = chrome.identity.getRedirectURL();
  const code_verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const code_challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(code_verifier))));
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id: CONFIG.googleClientId, redirect_uri, response_type: 'code',
    scope: 'openid email', code_challenge, code_challenge_method: 'S256', state, nonce,
    hd: 'castelobrancocontabilidade.com.br'}).toString();
  const returned = await chrome.identity.launchWebAuthFlow({url: url.href, interactive: true});
  if (!returned) throw new Error('Login Google não concluído.');
  const callback = new URL(returned);
  const expected = new URL(redirect_uri);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname ||
      callback.searchParams.get('state') !== state || !callback.searchParams.get('code') ||
      callback.searchParams.has('error')) throw new Error('Resposta de login Google inválida.');
  const response = await fetch(`${API}/v1/auth/google-code`, {method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code: callback.searchParams.get('code'), code_verifier, nonce, redirect_uri})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}${data.detail ? `: ${data.detail}` : ''}`);
  if (typeof data.id_token !== 'string' || data.id_token.split('.').length !== 3 ||
      !Number.isSafeInteger(data.exp) || data.exp * 1000 <= Date.now() ||
      typeof data.email !== 'string' || typeof data.sub !== 'string' || !data.sub.trim() ||
      data.sub.length > 255) throw new Error('Sessão inválida recebida da API.');
  await chrome.storage.session.set({googleSession: {id_token: data.id_token, email: data.email,
    sub: data.sub, exp: data.exp},
    authProblem: null});
  await broadcastPolicy();
  return {email: data.email, sub: data.sub, exp: data.exp};
}

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
  const assignment = fingerprint === result.key_fingerprint && typeof result.person_name === 'string' && result.person_name.trim() &&
    typeof result.employee_id === 'string' && result.employee_id.trim() &&
    typeof result.department_code === 'string' && result.department_code.trim()
    ? {...result, key_matches: true, subject_bound: CLOUD} : null;
  await chrome.storage.session.set({machineAssignment: assignment});
  await chrome.storage.session.set({machineInfo: {...result, key_matches: fingerprint === result.key_fingerprint}});
  return assignment ? {...result, key_matches: true} : {...result, key_matches: fingerprint === result.key_fingerprint};
}

async function broadcastPolicy() {
  const allowed = await captureAllowed();
  const {googleSession} = CLOUD ? await chrome.storage.session.get('googleSession') : {};
  for (const port of policyPorts) {
    try { port.postMessage({type: 'block_policy', blocked: false,
      protocolVersion: BLOCKER_PROTOCOL_VERSION,
      protocolCompatible: policyPortProtocols.get(port) === BLOCKER_PROTOCOL_VERSION,
      machineAssigned: allowed && policyPortProtocols.get(port) === BLOCKER_PROTOCOL_VERSION,
      authExpiresAt: CLOUD ? googleSession?.exp * 1000 || 0 : null}); }
    catch { policyPorts.delete(port); }
  }
}

async function sendToApi(path, options = {}) {
  await ready;
  const {timeoutMs = 10_000, ...requestOptions} = options;
  if (CLOUD && !cloudConfigured()) throw new Error('Configuração OAuth da nuvem incompleta.');
  const identity = await credentials();
  if (CLOUD && !identity && path !== '/health') {
    await closeCloudSession('Sessão Google ausente ou expirada. Entre novamente.');
    throw new Error('Sessão Google ausente ou expirada. Entre novamente.');
  }
  const method = options.method || 'GET';
  const bodyText = options.body || '';
  const signed = (method === 'GET' && /^\/v1\/machines\/[0-9a-f-]{36}$/i.test(path)) ||
    (method === 'POST' && /^\/v1\/machines\/[0-9a-f-]{36}\/assignment-request$/i.test(path)) ||
    (method === 'POST' && (path === '/v1/stream-captures' ||
    path === '/v1/artifact-metadata' || path === '/v1/interactions' ||
    /^\/v1\/interactions\/[0-9a-f-]{36}\/response$/i.test(path)));
  const signedHeaders = signed ? await machineHeaders(path, method, bodyText) : {};
  const response = await fetch(`${API}${path}`, {
    ...requestOptions,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {'Content-Type': 'application/json', ...(identity ? {Authorization: `Bearer ${identity.id_token}`} : {}),
      ...signedHeaders, ...options.headers}
  });
  const data = await response.json().catch(() => ({}));
  if (CLOUD && (response.status === 401 || response.status === 403))
    await closeCloudSession('Acesso Google recusado. Entre novamente ou solicite a atribuição da instalação.');
  if (!response.ok) throw new Error(`HTTP ${response.status}${data.detail ? `: ${data.detail}` : ''}`);
  return data;
}

async function status() {
  await ready;
  await pruneLocalHistory();
  const config = await chrome.storage.local.get(['enabled', 'lastCaptures', 'lastArtifacts', 'captureDiagnostics']);
  const {installationId} = await chrome.storage.local.get('installationId');
  let identity = await credentials();
  let {machineAssignment = null, machineInfo = null} = await chrome.storage.session.get(['machineAssignment', 'machineInfo']);
  if (!identity) machineAssignment = null;
  if (identity) {
    try {
      const current = await loadMachineAssignment();
      machineInfo = current;
      machineAssignment = current?.person_name && current?.employee_id && current?.department_code &&
        current?.key_matches ? {...current, subject_bound: CLOUD} : null;
    } catch {
      machineAssignment = null;
      await chrome.storage.session.set({machineAssignment: null});
      identity = await credentials();
    }
  }
  const fullyAssigned = Boolean(machineAssignment?.person_name && machineAssignment?.employee_id &&
    machineAssignment?.department_code && machineAssignment?.key_matches === true &&
    (!CLOUD || machineAssignment.subject_bound === true));
  const {privacyAcceptance = null} = await chrome.storage.local.get('privacyAcceptance');
  const privacySubject = CLOUD ? identity?.sub : machineAssignment?.employee_id;
  const privacyAccepted = Boolean(privacySubject && privacyAcceptance?.version === PRIVACY_NOTICE_VERSION &&
    privacyAcceptance.subject === privacySubject && Number.isFinite(Date.parse(privacyAcceptance.accepted_at)));
  if (config.enabled === true && (!identity || !fullyAssigned || !privacyAccepted)) {
    config.enabled = false;
    await chrome.storage.local.set({enabled: false});
    await updateProbeConfig(false);
  }
  await broadcastPolicy();
  const {authProblem = null} = await chrome.storage.session.get('authProblem');
  return {enabled: config.enabled === true && Boolean(identity) && fullyAssigned,
    configured: CLOUD ? cloudConfigured() : Boolean(identity), cloud: CLOUD,
    email: CLOUD ? identity?.email || null : null, sub: CLOUD ? identity?.sub || null : null,
    authProblem, installationId, machineAssignment, machineInfo,
    privacyNotice: {version: PRIVACY_NOTICE_VERSION, accepted: privacyAccepted,
      acceptedAt: privacyAccepted ? privacyAcceptance.accepted_at : null},
    lastCaptures: config.lastCaptures || [],
    lastArtifacts: config.lastArtifacts || [], captureDiagnostics: config.captureDiagnostics || []};
}

async function recordDiagnostic(stage, details = {}) {
  if (!await captureAllowed()) return;
  const diagnostic = {stage, at: new Date().toISOString(), ...details};
  await updateLocalHistory('captureDiagnostics', entries => {
    const retained = stage === 'blocker_health' ? entries.filter(item => item.stage !== 'blocker_health') : entries;
    return [...retained, diagnostic].slice(-30);
  });
}

function historyTimestamp(key, item) {
  const value = key === 'captureDiagnostics' ? item?.at :
    key === 'turnLinks' ? item?.[3] : item?.stored_at || item?.observed_at;
  const timestamp = Date.parse(value || '');
  const now = Date.now();
  return Number.isFinite(timestamp) && timestamp <= now + 5 * 60 * 1000 && timestamp > now - LOCAL_RETENTION_MS;
}

async function updateLocalHistory(key, update) {
  const operation = localHistoryWrites.then(async () => {
    const {[key]: stored} = await chrome.storage.local.get(key);
    const hadValue = stored !== undefined;
    const entries = Array.isArray(stored) ? stored.filter(item => historyTimestamp(key, item)) : [];
    const result = update(entries);
    if (!hadValue && result.length === 0) return result;
    await chrome.storage.local.set({[key]: result});
    return result;
  });
  localHistoryWrites = operation.catch(() => {});
  return operation;
}

async function pruneLocalHistory() {
  await Promise.all(['lastCaptures', 'lastArtifacts', 'captureDiagnostics', 'turnLinks']
    .map(key => updateLocalHistory(key, entries => key === 'turnLinks' ? entries.filter(item =>
      Array.isArray(item) && item.length === 4 && typeof item[0] === 'string' &&
      /^[0-9a-f-]{36}$/i.test(item[1] || '') && /^[0-9a-f]{64}$/i.test(item[2] || '')) : entries)));
}

chrome.alarms?.onAlarm?.addListener(alarm => {
  if (alarm.name === 'privacy-retention-cleanup') pruneLocalHistory().catch(() => {});
});

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
  await updateLocalHistory('turnLinks', entries => [...entries.filter(item => item[0] !== key),
    [key, interactionId, promptHash, new Date().toISOString()]].slice(-500));
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
    if (popup && message.type === 'delete_local_data') {
      await chrome.storage.local.clear();
      await chrome.storage.session.clear();
      await chrome.storage.local.set({installationId: crypto.randomUUID()});
      await broadcastPolicy();
      await updateProbeConfig(false);
      return {deleted: true};
    }
    if (popup && message.type === 'accept_privacy_notice') {
      if (message.version !== PRIVACY_NOTICE_VERSION) throw new Error('O aviso mudou. Atualize a extensão e leia a versão atual.');
      const [{googleSession}, {machineAssignment}] = await Promise.all([
        chrome.storage.session.get(['googleSession']), chrome.storage.session.get(['machineAssignment'])]);
      const subject = CLOUD ? googleSession?.sub : machineAssignment?.employee_id;
      if (!subject) throw new Error('Entre na conta corporativa e conclua a atribuição antes de confirmar ciência.');
      const {privacyAcceptance} = await chrome.storage.local.get('privacyAcceptance');
      if (privacyAcceptance?.version !== PRIVACY_NOTICE_VERSION || privacyAcceptance.subject !== subject ||
          !Number.isFinite(Date.parse(privacyAcceptance.accepted_at))) {
        await chrome.storage.local.set({privacyAcceptance: {
          version: PRIVACY_NOTICE_VERSION, subject, accepted_at: new Date().toISOString()
        }, enabled: false});
      }
      return {accepted: true};
    }
    if (popup && message.type === 'login') {
      if (!CLOUD) throw new Error('Login Google disponível apenas no modo nuvem.');
      const account = await googleLogin();
      await registerAndLoadMachine();
      await broadcastPolicy();
      return account;
    }
    if (popup && message.type === 'logout') {
      await closeCloudSession('Você saiu da conta Google.');
      return {signedOut: true};
    }
    if (popup && message.type === 'save') {
      if (typeof message.token !== 'string') throw new Error('Token inválido.');
      const suppliedToken = message.token.trim();
      const {captureApiToken: currentToken = ''} = CLOUD ? {} : await chrome.storage.session.get('captureApiToken');
      if (CLOUD && suppliedToken) throw new Error('Token local não é aceito no modo nuvem.');
      if (suppliedToken && suppliedToken.length < 24) throw new Error('O token precisa ter pelo menos 24 caracteres.');
      if (!CLOUD && message.enabled === true && !suppliedToken && !currentToken)
        throw new Error('Informe o CAPTURE_API_TOKEN definido em backend/.env (mínimo de 24 caracteres).');
      if (suppliedToken) await chrome.storage.session.set({captureApiToken: suppliedToken});
      let enableCapture = message.enabled === true;
      if (enableCapture) {
        if (!(await captureReadiness()).privacy_notice_accepted)
          throw new Error('Leia e confirme ciência do aviso de privacidade antes de ativar a captura.');
        if (CLOUD && !await credentials()) throw new Error('Entre com sua conta Google antes de ativar a captura.');
        const assignment = await registerAndLoadMachine();
        if (!assignment.person_name || !assignment.employee_id || !assignment.department_code || assignment.key_matches !== true) {
          await chrome.storage.local.set({enabled: false});
          await updateProbeConfig(false);
          const missing = [
            !assignment.person_name && 'nome do colaborador',
            !assignment.employee_id && 'ID do colaborador',
            !assignment.department_code && 'código do departamento',
            assignment.key_matches !== true && 'conferência da chave da instalação'
          ].filter(Boolean).join(', ');
          throw new Error(`Captura pausada: falta atribuir ${missing}. Peça ao operador para completar a atribuição no backend.`);
        }
      }
      await chrome.storage.local.set({enabled: enableCapture});
      await broadcastPolicy();
      await updateProbeConfig(enableCapture);
      return {saved: true};
    }
    if (popup && message.type === 'machine_register') {
      const assignment = await registerAndLoadMachine();
      await broadcastPolicy();
      return assignment;
    }
    if (popup && message.type === 'machine_assignment_request') {
      const employeeId = typeof message.employeeId === 'string' ? message.employeeId.trim() : '';
      if (!/^[A-Za-z0-9._@:-]{1,128}$/.test(employeeId)) throw new Error('Informe um código de colaborador válido.');
      const machine = await registerAndLoadMachine();
      if (machine.person_name) throw new Error('Esta instalação já está atribuída.');
      const {installationId} = await chrome.storage.local.get('installationId');
      return sendToApi(`/v1/machines/${installationId}/assignment-request`, {
        method: 'POST', body: JSON.stringify({employee_id: employeeId})});
    }
    if (popup && message.type === 'health') return sendToApi('/health');

    if (page && message.type === 'probe_config') {
      return {enabled: await captureAllowed()};
    }

    if (page && message.type === 'backend_preflight') {
      if (message.protocolVersion !== BLOCKER_PROTOCOL_VERSION)
        return {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: false, reason: 'extension_mismatch'};
      if (!await captureAllowed())
        return {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: false, reason: 'capture_unavailable'};
      try {
        const health = await sendToApi('/health', {timeoutMs: 5_000, cache: 'no-store'});
        if (health?.status !== 'ok')
          return {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: false, reason: 'backend_unavailable'};
        return await captureAllowed()
          ? {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: true, reason: null}
          : {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: false, reason: 'capture_unavailable'};
      } catch { return {protocolVersion: BLOCKER_PROTOCOL_VERSION, available: false, reason: 'backend_unavailable'}; }
    }

    if (page && ['remember_turn', 'lookup_turn'].includes(message.type)) {
      if (!await captureAllowed()) throw new Error('Captura pausada na extensão.');
      const key = turnLinkKey(message.conversationUrl, message.turnKey);
      if (!key) throw new Error('Turno invÃ¡lido.');
      if (message.type === 'lookup_turn') {
        const turnLinks = await updateLocalHistory('turnLinks', entries => entries);
        const link = [...turnLinks].reverse().find(item => item[0] === key);
        return {interaction_id: link?.[1] || null, prompt_hash: link?.[2] || null};
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.interactionId || ''))
        throw new Error('InteraÃ§Ã£o invÃ¡lida.');
      if (!/^[0-9a-f]{64}$/i.test(message.promptHash || '')) throw new Error('Hash de prompt invÃ¡lido.');
      await rememberTurnLink(key, message.interactionId, message.promptHash);
      return {stored: true};
    }

    if (page && message.type === 'capture_prompt') {
      const item = message.payload;
      if (!await captureAllowed()) throw new Error('CAPTURE_PAUSED');
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
      const item = message.payload;
      if (!await captureAllowed() || !/^[0-9a-f-]{36}$/i.test(message.interactionId || '') ||
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
      if (!await captureAllowed()) throw new Error('Captura pausada na extensão.');
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
      await updateLocalHistory('lastArtifacts', entries => [...entries, {...saved, source: item.source,
        file_name: item.file_name, mime_type: item.mime_type, size_bytes: item.size_bytes,
        conversation_context: item.conversation_context || null, size_source: item.size_source || null,
        observed_at: item.observed_at, stored_at: new Date().toISOString()}].slice(-20));
      await recordDiagnostic('artifact_metadata_stored', {source: item.source,
        mime_type: item.mime_type, conversation_id: item.conversation_context?.conversation_id || null,
        size_source: item.size_source});
      return saved;
    }

    if (page && message.type === 'stream_capture') {
      const item = message.payload;
      await recordDiagnostic('capture_received', {capture_status: item?.capture_status || 'invalid',
        frames: item?.frames ?? null, bytes: item?.bytes ?? null});
      if (!await captureAllowed()) throw new Error('Captura pausada na extensão.');
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
      await updateLocalHistory('lastCaptures', entries => [...entries, {capture_id: item.capture_id,
        status: saved.status, frames: item.frames, bytes: item.bytes, response_chars: item.response_chars,
        observed_at: item.observed_at, stored_at: new Date().toISOString()}].slice(-20));
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
      details.assistant_finished = item.assistant_finished === true;
      details.assistant_end_turn = item.assistant_end_turn === true;
      details.assistant_active = item.assistant_active === true;
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
      const methods = new Set(['click', 'enter', 'submit', 'regenerate', 'network']);
      if (message.version !== '0.1.2' || message.destination !== 'not_approved' || !actions.has(message.action) ||
          !methods.has(message.method) || !Array.isArray(message.findings) || message.findings.length > 12 ||
          !message.findings.every(item => rules.has(item.rule) && actions.has(item.action) &&
            Number.isSafeInteger(item.count) && item.count >= 1 && item.count <= 100))
        throw new Error('Decisão de política inválida.');
      await recordDiagnostic('policy_decision', {action: message.action, method: message.method,
        findings: message.findings.map(({rule, action, count}) => ({rule, action, count})),
        ...await captureReadiness()});
      return {logged: true};
    }
    if (page && message.type === 'blocker_health') {
      if (typeof message.mainActive !== 'boolean' || typeof message.blocked !== 'boolean' ||
          typeof message.synchronized !== 'boolean' || typeof message.machineAssigned !== 'boolean' ||
          typeof message.authExpired !== 'boolean' ||
          (message.protocolCompatible !== undefined && typeof message.protocolCompatible !== 'boolean'))
        throw new Error('Estado do bloqueio inválido.');
      await recordDiagnostic('blocker_health', {main_active: message.mainActive,
        policy_synchronized: message.synchronized, page_capture_allowed: message.machineAssigned,
        auth_expired: message.authExpired, protocol_compatible: message.protocolCompatible === true,
        network_gate_blocked: message.mainBlocked === true,
        ...await captureReadiness()});
      return {logged: true};
    }
    if (page && message.type === 'prompt_blocked') {
      if (!['click', 'enter', 'submit', 'network'].includes(message.method)) throw new Error('Método inválido.');
      await recordDiagnostic('prompt_blocked', {method: message.method,
        reason: ['expired', 'missing', 'backend_unavailable', 'capture_unavailable',
          'extension_mismatch', 'extension_unavailable'].includes(message.reason)
          ? message.reason : null});
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
    policyPortProtocols.set(port, message.protocolVersion);
    const protocolCompatible = message.protocolVersion === BLOCKER_PROTOCOL_VERSION;
    try {
      port.postMessage({type: 'block_policy', blocked: false, machineAssigned: false,
        protocolVersion: BLOCKER_PROTOCOL_VERSION, protocolCompatible});
      if (!protocolCompatible) return;
      if (await credentials()) await loadMachineAssignment();
      port.postMessage({type: 'block_policy', blocked: false,
        protocolVersion: BLOCKER_PROTOCOL_VERSION, protocolCompatible: true,
        machineAssigned: await captureAllowed(), authExpiresAt: CLOUD
          ? (await chrome.storage.session.get('googleSession')).googleSession?.exp * 1000 || 0 : null});
    } catch {
      await chrome.storage.session.set({machineAssignment: null});
      await chrome.storage.local.set({enabled: false});
      await broadcastPolicy();
      await updateProbeConfig(false);
      try { port.postMessage({type: 'block_policy', blocked: false, machineAssigned: false,
        protocolVersion: BLOCKER_PROTOCOL_VERSION, protocolCompatible}); } catch { policyPorts.delete(port); }
    }
  });
});
