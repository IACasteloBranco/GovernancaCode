const $ = id => document.getElementById(id);
let sessionAuthenticated = false;
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
async function probeCurrentTab() {
  const target = $('tab-state');
  if (!chrome.tabs?.query || !chrome.tabs?.sendMessage) {
    target.textContent = 'Diagnóstico da aba indisponível nesta versão do navegador.';
    return;
  }
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) {
    target.textContent = 'Nenhuma aba ativa encontrada.';
    return;
  }
  const probe = async type => {
    try { return await chrome.tabs.sendMessage(tab.id, {type}); }
    catch (error) {
      return {active: false, error: String(error?.message || error || 'erro desconhecido').slice(0, 240)};
    }
  };
  const [policy, observer] = await Promise.all([
    probe('governanca_probe_policy'), probe('governanca_probe_observer')
  ]);
  if (!policy?.active && !observer?.active) {
    const errors = [policy?.error, observer?.error].filter(Boolean);
    let origin = 'aba atual';
    try { origin = new URL(tab.url).origin; } catch { /* URL indisponível em algumas abas. */ }
    target.textContent = `Sondas não responderam nesta aba (${origin}). ` +
      (errors.length ? `Chrome: ${[...new Set(errors)].join(' | ')}. ` : '') +
      'Confirme que a extensão POC 0.3.3 está ativada neste perfil e recarregue a aba.';
    return;
  }
  if (!policy?.active || !observer?.active) {
    const missing = policy?.active ? observer : policy;
    target.textContent = `Scripts incompletos (política: ${policy?.active ? 'ativa' : 'ausente'}; captura: ${observer?.active ? 'ativa' : 'ausente'}). ` +
      (missing?.error ? `Chrome: ${missing.error}. ` : '') + 'Recarregue a aba.';
    return;
  }
  target.textContent = `Plataforma: ${policy.platform}. Política e captura ativas. Editor: ${observer.editor_found ? 'encontrado' : 'não encontrado'}. Botão de envio: ${observer.send_found ? 'encontrado' : 'não encontrado'}. Campos editáveis: ${observer.editable_count}.`;
}
async function refresh() {
  const config = await send({type: 'status'});
  sessionAuthenticated = config.authenticated === true;
  const requested = config.captureRequested ?? config.enabled;
  await probeCurrentTab().catch(() => { $('tab-state').textContent = 'Não foi possível verificar a aba ativa.'; });
  $('account').value = config.account || '';
  $('enabled').checked = requested;
  $('token').required = !sessionAuthenticated && $('enabled').checked;
  $('block-prompts').checked = config.blockPrompts === true;
  const captureReason = !requested ? 'desligada na configuração'
    : !config.authenticated ? 'pausada — informe o token após recarregar a extensão'
    : !config.machineAssignment ? 'pausada — atualize o vínculo da instalação'
    : 'habilitada';
  $('identity').textContent = `API: ${config.api}\nCódigo da instalação: ${config.installationId}\nPOC: 0.3.3\nAdapter: 0.3.2-network\nPolítica: ${config.policyVersion} (${config.destination})\nBloqueio manual: ${config.blockPrompts ? 'ligado' : 'desligado'}\nCaptura: ${captureReason}`;
  $('machine-binding').textContent = config.machineAssignment
    ? `Pessoa: ${config.machineAssignment.personName}\nChave: ${config.machineAssignment.keyFingerprint?.slice(0, 16) || '?'}…`
    : 'Instalação sem atribuição confirmada. O envio fica bloqueado até a atribuição da pessoa.';
  const {events = []} = await send({type: 'diagnostics'});
  $('events').textContent = events.slice().reverse().map(e => `${e.at} ${e.type}: ${e.result}${e.id ? '\n' + e.id : ''}`).join('\n');
  const {probeEvents = []} = await send({type: 'probe_diagnostics'});
  $('probe-events').textContent = probeEvents.slice().reverse().map(e => `${e.at} tab=${e.tabId} attempt=${e.id}\n${e.result}`).join('\n');
  const latest = events.slice().reverse().find(event => event.type === 'decision');
  if (latest) {
    const action = latest.result.match(/^(ALLOW|WARN|REVIEW|BLOCK)\b/)?.[1];
    const primaryRule = latest.result.match(/\bprimary=([A-Z0-9]+)\b/)?.[1];
    const count = Number(latest.result.match(new RegExp(`\\b${primaryRule}:(\\d+)\\b`))?.[1] || 1);
    if (action && primaryRule) {
      const description = globalThis.GovernancaPolicyMessages.describe({action, primaryRule,
        findings: [{rule: primaryRule, count}]});
      $('last-decision').textContent = description;
    }
  }
}
$('enabled').addEventListener('change', () => {
  $('token').required = $('enabled').checked && !sessionAuthenticated;
});
$('blocking').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await send({type: 'save_blocking', blocked: $('block-prompts').checked});
    $('status').textContent = 'Regra de envio aplicada às abas abertas.';
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
$('config').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await send({type: 'save', account: $('account').value, token: $('token').value, enabled: $('enabled').checked});
    $('token').value = '';
    $('status').textContent = 'Configuração salva.';
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
$('health').addEventListener('click', async () => {
  try {
    const result = await send({type: 'health'});
    $('status').textContent = result.schema_version === '0.1' ? 'API acessível. Este teste não valida o token.' : 'Esquema incompatível.';
  } catch (error) { $('status').textContent = error.message; }
});
$('machine-register').addEventListener('click', async () => {
  try {
    const result = await send({type: 'machine_register'});
    $('status').textContent = result.person_name
      ? 'Vínculo da instalação atualizado.'
      : `Instalação cadastrada. Chave ${result.key_fingerprint?.slice(0, 16) || '?'}… O operador precisa atribuir a pessoa no backend.`;
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
refresh().catch(() => { $('status').textContent = 'Não foi possível carregar o diagnóstico.'; });
