const API = 'http://127.0.0.1:8000';
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const {installationId} = await chrome.storage.local.get('installationId');
  if (!installationId) await chrome.storage.local.set({installationId: crypto.randomUUID()});
})();

async function request(path, method = 'GET', body) {
  const {token} = await chrome.storage.session.get('token');
  if (path !== '/health' && !token) throw new Error('Token ausente');
  const response = await fetch(API + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function dispatch(message, sender) {
  await ready;
  const popup = !sender.tab && sender.url === chrome.runtime.getURL('src/popup/diagnostics.html');
  const page = sender.tab && sender.frameId === 0 && new URL(sender.url).origin === 'https://chatgpt.com';
  if (!popup && !page) throw new Error('Origem inválida');
  const config = await chrome.storage.local.get(['installationId', 'account', 'enabled']);
  const {token} = await chrome.storage.session.get('token');
  if (message.type === 'status') return {...config, enabled: Boolean(config.enabled && token), authenticated: Boolean(token), api: API};
  if (popup && message.type === 'save') {
    if (typeof message.account !== 'string' || message.account.length > 320) throw new Error('Conta inválida');
    if (typeof message.token !== 'string' || message.token.length < 24) throw new Error('Informe o token de laboratório');
    await chrome.storage.local.set({account: message.account, enabled: Boolean(message.enabled)});
    await chrome.storage.session.set({token: message.token});
    return {saved: true};
  }
  if (popup && message.type === 'health') return request('/health');
  if (popup && message.type === 'diagnostics') return chrome.storage.session.get('events');
  if (!page || !config.enabled || !token) throw new Error('Captura pausada');
  if (message.type === 'prompt') {
    const p = message.payload;
    if (!p || typeof p.prompt?.text !== 'string' || p.prompt.text.length > 100000) throw new Error('Prompt inválido');
    const result = await request('/v1/interactions', 'POST', {
      ...p, schema_version: '0.1', platform: 'chatgpt_web', attachments: [],
      device_installation_id: config.installationId, account_label: config.account || null, adapter_version: '0.1.11'
    });
    if (!/^[0-9a-f-]{36}$/i.test(result.interaction_id)) throw new Error('Confirmação inválida');
    await chrome.storage.session.set({[`binding:${result.interaction_id}`]: sender.documentId});
    return result;
  }
  if (message.type === 'response' && /^[0-9a-f-]{36}$/i.test(message.id)) {
    const key = `binding:${message.id}`;
    const binding = await chrome.storage.session.get(key);
    if (!sender.documentId || binding[key] !== sender.documentId) throw new Error('Vínculo inválido');
    const result = await request(`/v1/interactions/${message.id}/response`, 'POST', message.payload);
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
function log(type, result, id) {
  logging = logging.then(async () => {
    const {events = []} = await chrome.storage.session.get('events');
    events.push({type, result, id: id || null, at: new Date().toISOString()});
    await chrome.storage.session.set({events: events.slice(-100)});
  }).catch(() => {});
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  dispatch(message, sender).then(data => {
    if (message.type === 'prompt') log('prompt', 'confirmed', data.interaction_id);
    if (message.type === 'response') log('response', `confirmed:${data.status}`, data.interaction_id);
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
