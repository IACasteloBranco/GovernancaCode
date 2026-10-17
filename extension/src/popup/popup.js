const $ = id => document.getElementById(id);
let currentConfig;
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Sem resposta da extensão.');
  return result.data;
}
async function refresh() {
  const config = await send({type: 'status'});
  currentConfig = config;
  $('enabled').checked = config.enabled;
  $('cloud-login').hidden = !config.cloud;
  $('local-token').hidden = config.cloud;
  $('login').disabled = config.cloud && !config.configured;
  $('logout').disabled = !config.email;
  $('account').textContent = config.cloud
    ? config.email ? `Conta Google: ${config.email}` : config.authProblem ||
      (config.configured ? 'Entre com sua conta Google individual.' : 'Configuração OAuth da nuvem incompleta.')
    : '';
  $('account-sub').hidden = !config.sub;
  $('sub').textContent = config.sub || '';
  const machineInfo = config.machineInfo;
  $('identity').textContent = `Instalação: ${config.installationId}\nColaborador: ${machineInfo?.person_name || 'aguardando atribuição'}\nID: ${machineInfo?.employee_id || 'pendente'}\nDepartamento: ${machineInfo?.department_code || 'pendente'}\nFingerprint: ${machineInfo?.key_fingerprint || 'cadastre a instalação'}\nChave: ${machineInfo?.key_matches === false ? 'diverge do cadastro' : machineInfo?.key_matches ? 'conferida' : 'não verificada'}`;
  $('captures').textContent = config.lastCaptures.length
    ? config.lastCaptures.slice().reverse().map(item => `${item.observed_at}  ${item.status}  ${item.bytes} B  ${item.frames} frames`).join('\n')
    : 'Nenhuma captura ainda.';
  $('artifacts').textContent = config.lastArtifacts.length
    ? config.lastArtifacts.slice().reverse().map(item => {
      const name = item.file_name || 'nome não informado';
      const type = item.mime_type || 'tipo desconhecido';
      const size = Number.isSafeInteger(item.size_bytes) ? `${item.size_bytes} B` : 'tamanho não informado';
      const conversation = item.conversation_context?.conversation_id
        ? ` conversa=${item.conversation_context.conversation_id} (rota ativa)` : '';
      return `${item.observed_at}  ${name}  ${type}  ${size}  origem=${item.source}${conversation}`;
    }).join('\n')
    : 'Nenhum metadado de arquivo ainda.';
  $('diagnostics').textContent = config.captureDiagnostics.length
    ? config.captureDiagnostics.slice().reverse().map(item => `${item.at}  ${item.stage}  ${JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !['at', 'stage'].includes(key))))}`).join('\n')
    : 'Sem eventos. Envie uma resposta sintética com a captura ativada.';
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) { $('probe-status').textContent = 'Nenhuma aba ativa.'; return; }
  try {
    const probe = await chrome.tabs.sendMessage(tab.id, {type: 'probe_status'});
    $('probe-status').textContent = probe?.active ? `Ativa (adapter ${probe.adapterVersion}).` : 'Sonda não respondeu.';
  } catch {
    $('probe-status').textContent = 'Sonda não carregada nesta aba. Recarregue a aba do ChatGPT após recarregar a extensão.';
  }
}
$('config').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await send({type: 'save', token: $('token').value, enabled: $('enabled').checked});
    $('token').value = '';
    $('status').textContent = 'Configuração salva. Recarregue a aba do ChatGPT.';
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
$('login').addEventListener('click', async () => {
  try {
    if (!currentConfig?.configured) throw new Error('Configuração OAuth da nuvem incompleta.');
    await send({type: 'login'});
    $('status').textContent = 'Conta Google conectada. Confira a atribuição da instalação antes de ativar a captura.';
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
$('logout').addEventListener('click', async () => {
  try { await send({type: 'logout'}); await refresh(); }
  catch (error) { $('status').textContent = error.message; }
});
$('health').addEventListener('click', async () => {
  try { const data = await send({type: 'health'}); $('status').textContent = `API disponível (schema ${data.schema_version}).`; }
  catch (error) { $('status').textContent = error.message; }
});
$('register-machine').addEventListener('click', async () => {
  try {
    const result = await send({type: 'machine_register'});
    $('status').textContent = result.key_matches === false
      ? 'A chave local diverge do cadastro desta instalação. O bloqueio continua fechado; peça ao operador para verificar o fingerprint.'
      : result.person_name
      ? `Instalação atribuída a ${result.person_name}.`
      : `Instalação ${result.installation_id} cadastrada; atribua o fingerprint ${result.key_fingerprint?.slice(0, 16) || '(indisponível)'}.`;
    await refresh();
  } catch (error) { $('status').textContent = error.message; }
});
refresh().catch(error => { $('status').textContent = error.message; });
