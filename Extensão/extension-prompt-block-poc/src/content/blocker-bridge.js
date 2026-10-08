(() => {
  const marker = 'governanca-ai-prompt-block-v1';
  const policyAttribute = 'data-governanca-block-prompts';
  const untilAttribute = 'data-governanca-allow-until';
  const destination = 'not_approved'; // Classificação dos destinos neste piloto.
  const platform = globalThis.GovernancaPlatform;
  const messages = globalThis.GovernancaPolicyMessages || {
    primary: () => 'ENGINE', describe: () => 'Envio retido: não foi possível mostrar o motivo da política.'
  };
  let manualBlocked = true; // Bloqueia até receber a configuração da extensão.
  let machineAssigned = false;
  let verification = 0;
  let lastAttempt = {at: 0, text: '', action: ''};

  function resetGrant() {
    const root = document.documentElement;
    root?.setAttribute(policyAttribute, 'block');
    root?.removeAttribute(untilAttribute);
  }
  resetGrant();
  document.addEventListener('readystatechange', resetGrant);

  function verifyMain() {
    const current = ++verification;
    window.postMessage({marker, phase: 'ping'}, location.origin);
    setTimeout(() => {
      if (verification !== current) return;
      chrome.runtime.sendMessage({type: 'blocker_health', mainActive: false,
        blocked: manualBlocked}).catch(() => {});
    }, 1000);
  }
  function connect() {
    try {
      const port = chrome.runtime.connect({name: 'prompt-block-policy'});
      port.onMessage.addListener(message => {
        if (message?.type !== 'block_policy') return;
        manualBlocked = message.blocked === true;
        machineAssigned = message.machineAssigned === true;
        resetGrant();
        lastAttempt = {at: 0, text: '', action: ''};
        verifyMain();
      });
      port.onDisconnect.addListener(() => {
        manualBlocked = true;
        machineAssigned = false;
        resetGrant();
        lastAttempt = {at: 0, text: '', action: ''};
        setTimeout(connect, 1000);
      });
      port.postMessage({type: 'block_status'});
    } catch { setTimeout(connect, 1000); }
  }
  connect();

  chrome.runtime.onMessage?.addListener((message, _sender, reply) => {
    if (message?.type !== 'governanca_probe_policy') return;
    reply({active: true, platform: platform?.claude ? 'claude_web' : 'chatgpt_web'});
  });

  const editor = () => {
    if (platform?.claude) return platform.editor();
    const candidates = [...(document.querySelectorAll?.('#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"]') || [])];
    return candidates.find(node => !node.getClientRects || node.getClientRects().length) ||
      candidates[0] || document.querySelector('#prompt-textarea') ||
      document.querySelector('[data-testid="prompt-textarea"]') ||
      document.querySelector('form [contenteditable="true"]');
  };
  const editorText = field => field?.innerText || field?.value || field?.textContent || '';

  function showNotice(text, urgent = false) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.setAttribute('role', urgent ? 'alert' : 'status');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#182a35;color:white;padding:10px 16px;border-radius:8px;font:14px system-ui;box-shadow:0 2px 12px #0005';
    (document.body || document.documentElement).append(toast);
    setTimeout(() => toast.remove(), 8000);
  }
  function logDecision(decision, method) {
    try {
      chrome.runtime.sendMessage({type: 'prompt_decision', action: decision.action,
        version: decision.version, destination, method,
        primaryRule: messages.primary(decision),
        findings: decision.findings.map(item => ({rule: item.rule, action: item.action, count: item.count}))
      }).catch(() => {});
    } catch { /* A falha do diagnóstico não altera a decisão local. */ }
  }
  function stop(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function inspect(event, method) {
    const text = editorText(editor()).trim();
    const attachments = globalThis.GovernancaFiles?.observe(platform?.fileRoot?.() || platform?.composer() || editor()?.closest?.('form'));
    if (!text && attachments?.capture_status !== 'observed') return;
    const now = Date.now();
    if (now - lastAttempt.at < 500 && text === lastAttempt.text) {
      if (lastAttempt.action === 'BLOCK' || lastAttempt.action === 'REVIEW') stop(event);
      return;
    }
    resetGrant();
    let decision;
    try {
      decision = globalThis.GovernancaPromptPolicy?.evaluate(text, {destination});
      if (!decision) throw new Error('Política indisponível');
    } catch {
      decision = {version: '0.1.2', action: 'REVIEW', findings: [{rule: 'ENGINE', action: 'REVIEW', count: 1}]};
    }
    if (manualBlocked) decision = {...decision, action: 'BLOCK',
      findings: [...decision.findings, {rule: 'MANUAL', action: 'BLOCK', count: 1}]};
    if (!machineAssigned)
      decision = {...decision, action: 'BLOCK',
        findings: [...decision.findings, {rule: 'MACHINE', action: 'BLOCK', count: 1}]};
    lastAttempt = {at: now, text, action: decision.action};
    logDecision(decision, method);
    if (decision.action === 'BLOCK' || decision.action === 'REVIEW') {
      stop(event);
      showNotice(messages.describe(decision), true);
      return;
    }
    document.documentElement?.setAttribute(policyAttribute, 'allow');
    document.documentElement?.setAttribute(untilAttribute, String(now + (attachments?.capture_status === 'observed' ? 120000 : 15000)));
    // Snapshot the allowed prompt before the application's event handlers clear it.
    globalThis.GovernancaCaptureAttempt?.();
    if (decision.action === 'WARN')
      showNotice(messages.describe(decision));
  }

  window.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    const form = editor()?.closest?.('form');
    if (platform?.claude ? platform.sendButton(button) : (button?.matches?.('button[data-testid="send-button"]') ||
        (form?.contains(button) && (button?.type === 'submit' ||
          /^(Enviar|Send)$/.test(button?.getAttribute?.('aria-label') || ''))))) inspect(event, 'click');
  }, true);
  window.addEventListener('keydown', event => {
    const field = editor();
    const inEditor = field && (field.contains(event.target) || event.composedPath?.().includes(field));
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && inEditor)
      inspect(event, 'enter');
  }, true);
  window.addEventListener('submit', event => {
    if (editor()?.closest?.('form') === event.target) inspect(event, 'submit');
  }, true);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.marker !== marker) return;
    if (event.data.phase === 'network_blocked') {
      const reason = event.data.reason === 'expired' ? 'expired' : 'missing';
      chrome.runtime.sendMessage({type: 'prompt_blocked', method: 'network', reason}).catch(() => {});
      showNotice(reason === 'expired' ? 'Envio impedido: o tempo para processar o anexo expirou. Tente enviar novamente.'
        : 'Envio impedido: não havia uma decisão válida para este prompt.');
    }
    if (event.data.phase === 'pong') {
      verification++;
      chrome.runtime.sendMessage({type: 'blocker_health', mainActive: true,
        blocked: manualBlocked, mainBlocked: event.data.blocked === true}).catch(() => {});
    }
  });
})();
