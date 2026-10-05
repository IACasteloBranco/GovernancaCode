const $ = id => document.getElementById(id);
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
async function refresh() {
  const config = await send({type: 'status'});
  $('account').value = config.account || '';
  $('enabled').checked = config.enabled;
  $('identity').textContent = `API: ${config.api}\nInstalação: ${config.installationId}\nAdapter: 0.1.11\nCaptura: ${config.enabled ? 'habilitada' : 'pausada'}`;
  const {events = []} = await send({type: 'diagnostics'});
  $('events').textContent = events.slice().reverse().map(e => `${e.at} ${e.type}: ${e.result}${e.id ? '\n' + e.id : ''}`).join('\n');
}
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
refresh().catch(() => { $('status').textContent = 'Não foi possível carregar o diagnóstico.'; });
