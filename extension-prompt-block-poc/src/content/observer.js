(() => {
  const platform = globalThis.GovernancaPlatform;
  const unavailableFiles = () => ({capture_status: 'unavailable', items: [], truncated: false});
  const files = (root, generated = false) => globalThis.GovernancaFiles?.observe(root, generated) || unavailableFiles();
  const errorMessage = error => {
    const detail = String(error?.message || error || 'Erro desconhecido');
    if (/Extension context invalidated/i.test(detail))
      return 'Contexto da extensão invalidado. Recarregue a aba do ChatGPT ou Claude.';
    if (/Receiving end does not exist|message port closed/i.test(detail))
      return 'Canal da extensão indisponível após tentativas de envio.';
    return detail;
  };
  const send = async message => {
    try {
      const result = await chrome.runtime.sendMessage(message);
      if (!result) throw new Error('Sem resposta do service worker da extensão.');
      if (!result.ok) throw new Error(result.error || 'Operação recusada pela extensão.');
      return result.data;
    } catch (error) {
      const wrapped = new Error(errorMessage(error));
      wrapped.originalMessage = String(error?.message || error || '');
      throw wrapped;
    }
  };
  const responseDelivery = async message => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await send(message); }
      catch (error) {
        const transient = /Receiving end does not exist|message port closed|Sem resposta do service worker/i
          .test(error.originalMessage || '');
        if (!transient || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, [1000, 3000, 8000][attempt]));
      }
    }
  };
  const roleOf = node => (platform?.claude ? platform.role(node) : null) || node?.getAttribute?.('data-message-author-role') ||
    node?.querySelector?.('[data-conversation-role]')?.getAttribute('data-conversation-role') || null;
  const messages = () => {
    if (platform?.claude) return platform.messages();
    const searchUnits = [...document.querySelectorAll('[data-content-search-unit-key]')].filter(node =>
      roleOf(node) === 'user' || roleOf(node) === 'assistant');
    return searchUnits.length ? searchUnits : [...document.querySelectorAll('[data-message-author-role]')];
  };
  const answers = () => {
    const current = messages();
    return current.length ? current.filter(node => roleOf(node) === 'assistant')
      : [...document.querySelectorAll('[data-message-author-role="assistant"]')];
  };
  const users = () => {
    const current = messages();
    return current.length ? current.filter(node => roleOf(node) === 'user')
      : [...document.querySelectorAll('[data-message-author-role="user"]')];
  };
  const visibleText = node => {
    if (roleOf(node) === 'assistant') {
      const blocks = [...(node?.querySelectorAll?.('[data-markdown-text-style="assistant-message"]') || [])];
      if (blocks.length) return blocks.map(block => (block.innerText || block.textContent || '').trim()).filter(Boolean).join('\n').trim();
      if (node?.hasAttribute?.('data-content-search-unit-key')) return '';
    }
    return (node?.innerText || node?.textContent || '').trim();
  };
  const routeKey = href => {
    const url = new URL(href);
    return url.origin + url.pathname;
  };
  const conversationId = href => new URL(href).pathname.match(/(?:^|\/)(?:c|chat)\/([^/]+)/)?.[1] || null;
  const projectId = href => {
    const segment = new URL(href).pathname.match(/(?:^|\/)g\/(g-p-[^/]+)(?:\/|$)/)?.[1];
    return segment?.match(/^(g-p-[a-fA-F0-9]{32})-[a-zA-Z0-9-]+$/)?.[1] ||
      (/^g-p-[a-zA-Z0-9]+$/.test(segment || '') ? segment : null);
  };
  const visible = node => !node?.getClientRects || node.getClientRects().length > 0;
  const editor = () => {
    if (platform?.claude) return platform.editor();
    const candidates = [...document.querySelectorAll('#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"]')];
    return candidates.find(visible) || candidates[0] || document.querySelector('#prompt-textarea') ||
      document.querySelector('[data-testid="prompt-textarea"]') ||
      document.querySelector('form [contenteditable="true"]');
  };
  const composerRoot = () => platform?.composer() || editor()?.closest?.('form');
  const composerButtons = () => [...(composerRoot()?.querySelectorAll?.('button') || [])]
    .filter(visible);
  const composerStop = () => platform?.claude ? platform.streaming() : composerButtons().some(button =>
    /^(Parar|Stop|Stop generating)$/.test(button.getAttribute?.('aria-label') || ''));
  const composerReady = () => platform?.claude ? platform.ready() : composerButtons().some(button =>
    /^(Iniciar conversa por voz|Enviar|Start voice chat|Send)$/.test(button.getAttribute?.('aria-label') || ''));
  const streaming = () => {
    const oldStop = document.querySelector('button[data-testid="stop-button"]');
    return Boolean(oldStop && visible(oldStop)) || composerStop();
  };
  let active = null;
  let lastAttempt = 0;
  const responseControls = state => Boolean(state.answerNode?.hasAttribute?.('data-content-search-unit-key') &&
    state.answerNode.closest?.('[data-turn-key]')?.querySelector?.('.turn-action-controls'));

  const hasContent = node => Boolean(visibleText(node) || files(node, true).capture_status === 'observed');
  const hasResponse = state => Boolean(state.text.trim() || state.materials?.capture_status === 'observed');
  function updateAnswer(state, answer) {
    if (!answer) return;
    const text = visibleText(answer);
    const materials = files(answer, true);
    if (text !== state.text || JSON.stringify(materials) !== JSON.stringify(state.materials)) state.changed = Date.now();
    state.answerNode = answer;
    state.text = text;
    state.materials = materials;
  }

  function observeAnswer(state) {
    const orderedMessages = messages();
    const latestUserIndex = orderedMessages.findLastIndex(node =>
      roleOf(node) === 'user');
    if (latestUserIndex >= 0 && visibleText(orderedMessages[latestUserIndex]) === state.promptText) {
      const followingAnswers = orderedMessages.slice(latestUserIndex + 1).filter(node =>
        roleOf(node) === 'assistant');
      if (followingAnswers.filter(hasContent).length > 1) state.ambiguous = true;
      const answer = followingAnswers.slice().reverse().find(hasContent);
      updateAnswer(state, answer);
      if (streaming()) state.seenStreaming = true;
      if (composerStop()) state.seenComposerStop = true;
      return;
    }
    const currentAnswers = answers();
    if (currentAnswers.length < state.baselineCount) state.baselineCount = currentAnswers.length;
    const candidates = currentAnswers.slice(state.baselineCount);
    if (candidates.filter(hasContent).length > 1) state.ambiguous = true;
    let answer = candidates.slice().reverse().find(hasContent);
    let text = visibleText(answer);
    // A página pode trocar mensagens antigas por novas mantendo o mesmo número de elementos.
    if (!answer && currentAnswers.length === state.baselineCount) {
      const latestText = visibleText(currentAnswers.at(-1));
      if (latestText && latestText !== state.baselineLastText) {
        answer = currentAnswers.at(-1);
        text = latestText;
      }
    }
    updateAnswer(state, answer);
    if (streaming()) state.seenStreaming = true;
    if (composerStop()) state.seenComposerStop = true;
  }

  function captureDiagnostics(state) {
    const orderedMessages = messages();
    const latestUserIndex = orderedMessages.findLastIndex(node =>
      roleOf(node) === 'user');
    const followingAnswers = orderedMessages.slice(latestUserIndex + 1).filter(node =>
      roleOf(node) === 'assistant');
    const markdown = [...document.querySelectorAll('main .markdown')];
    const articles = [...document.querySelectorAll('main article')];
    const main = document.querySelector('main');
    return {
      assistant_count: answers().length,
      user_count: orderedMessages.filter(node => roleOf(node) === 'user').length,
      answers_after_user: latestUserIndex < 0 ? 0 : followingAnswers.length,
      last_user_matches: latestUserIndex >= 0 && visibleText(orderedMessages[latestUserIndex]) === state.promptText,
      latest_assistant_chars: visibleText(answers().at(-1)).length,
      baseline_count: state.baselineCount,
      saw_streaming: state.seenStreaming,
      route_changed: routeKey(location.href) !== routeKey(state.origin),
      markdown_count: markdown.length,
      latest_markdown_chars: visibleText(markdown.at(-1)).length,
      article_count: articles.length,
      latest_article_chars: visibleText(articles.at(-1)).length,
      turn_count: document.querySelectorAll('[data-testid^="conversation-turn"]').length,
      alt_assistant_count: document.querySelectorAll('[data-role="assistant"], [data-message-author="assistant"], .agent-turn').length,
      main_chars: visibleText(main).length,
      iframe_count: document.querySelectorAll('iframe').length,
      search_units: document.querySelectorAll('[data-content-search-unit-key]').length,
      assistant_blocks: document.querySelectorAll('[data-markdown-text-style="assistant-message"]').length
    };
  }

  async function finish(state, status, reason = 'no_text', evidence = null) {
    if (state.done) return;
    state.done = true;
    if (active === state) active = null;
    const diagnostics = !hasResponse(state) ? captureDiagnostics(state) : null;
    try {
      const id = await state.delivery;
      if (!hasResponse(state)) {
        await send({type: 'capture_failed', id, reason, diagnostics});
        return;
      }
      await responseDelivery({type: 'response', id, reason, evidence, payload: {
        client_event_id: crypto.randomUUID(), text: state.text,
        generated_materials: state.materials || unavailableFiles(),
        capture_status: status, observed_at: new Date().toISOString(), adapter_version: '0.6.9'
      }});
    } catch (error) { console.warn('[Governança IA] Resposta sem confirmação de entrega:', errorMessage(error)); }
  }

  async function attempt() {
    const field = editor();
    const text = field?.innerText || field?.value || field?.textContent || '';
    if (!field) { console.warn('[Governança IA] Campo do prompt não encontrado após o envio.'); return; }
    const attachments = files(platform?.fileRoot?.() || composerRoot());
    if ((!text.trim() && attachments.capture_status !== 'observed') || Date.now() - lastAttempt < 500) return;
    lastAttempt = Date.now();
    const origin = location.href;
    const baselineAnswers = answers();
    const baselineCount = baselineAnswers.length;
    const baselineLastText = visibleText(baselineAnswers.at(-1));
    const previous = active;
    if (previous) observeAnswer(previous);
    // O estado do compositor pertence ao envio atual; após a consulta assíncrona
    // ele já pode mostrar "Parar" para a próxima resposta.
    const evidence = previous && {
      stop: streaming(), ready: composerReady(), ambiguous: previous.ambiguous,
      seen_streaming: previous.seenStreaming, seen_stop: previous.seenComposerStop,
      answer_controls: responseControls(previous), answer_chars: previous.text.length
    };
    const previousFinished = previous && !evidence.stop && !evidence.ambiguous &&
      (evidence.ready || (evidence.seen_streaming && !evidence.seen_stop));
    try {
      const config = await send({type: 'status'});
      if (!config.enabled) return;
      if (previous && active === previous) {
        void finish(previous, previousFinished ? 'complete' : 'incomplete', 'new_prompt', evidence);
      }
      const state = {origin, baselineCount, baselineLastText, promptText: text.trim(), text: '', started: Date.now(), changed: Date.now(), seenStreaming: false, seenComposerStop: false, routeAdopted: false, routePendingAt: null, ambiguous: false, done: false};
      active = state;
      state.delivery = send({type: 'prompt', payload: {
        client_event_id: crypto.randomUUID(), observed_at: new Date().toISOString(),
        project: projectId(origin)
          ? {url: `https://chatgpt.com/g/${projectId(origin)}/project`, capture_status: 'observed'}
          : {capture_status: 'unknown', reason: 'URL do projeto individual não identificada'},
        conversation: {url: origin, capture_status: 'observed'},
        attachments: attachments.items, attachments_capture_status: attachments.capture_status,
        attachments_truncated: attachments.truncated,
        prompt: {text, capture_status: 'observed'}
      }}).then(result => {
        globalThis.GovernancaFiles?.commit?.();
        return result.interaction_id;
      });
      state.delivery.catch(error => console.warn('[Governança IA] Prompt sem confirmação de entrega:', errorMessage(error)));
    } catch (error) { console.warn('[Governança IA] Captura indisponível:', errorMessage(error)); }
  }

  globalThis.GovernancaCaptureAttempt = () => { void attempt(); };
  chrome.runtime.onMessage?.addListener((message, _sender, reply) => {
    if (message?.type !== 'governanca_probe_observer') return;
    reply({active: true, editor_found: Boolean(editor()),
      send_found: platform?.claude ? [...document.querySelectorAll('button')].some(platform.sendButton) : Boolean(editor()),
      editable_count: document.querySelectorAll('[contenteditable="true"], textarea').length});
  });
  if (platform?.claude) {
    let previousHealth = '';
    const reportHealth = () => {
      const signals = {
        editor_found: Boolean(editor()),
        send_found: [...document.querySelectorAll('button')].some(platform.sendButton),
        editable_count: document.querySelectorAll('[contenteditable="true"], textarea').length
      };
      const key = JSON.stringify(signals);
      if (key === previousHealth) return;
      previousHealth = key;
      void send({type: 'observer_health', ...signals}).catch(() => {});
    };
    reportHealth();
    setInterval(reportHealth, 5000);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    const form = editor()?.closest?.('form');
    if (platform?.claude ? platform.sendButton(button) : (button?.matches?.('button[data-testid="send-button"]') ||
        (form?.contains(button) && (button?.type === 'submit' ||
          /^(Enviar|Send)$/.test(button?.getAttribute?.('aria-label') || ''))))) void attempt();
  }, true);
  document.addEventListener('submit', event => {
    if (editor()?.closest?.('form') === event.target) void attempt();
  }, true);
  document.addEventListener('keydown', event => {
    const field = editor();
    const inEditor = field && (field.contains(event.target) || event.composedPath?.().includes(field));
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && inEditor) void attempt();
  }, true);
  setInterval(() => {
    const state = active;
    if (!state || state.done) return;
    if (routeKey(location.href) !== routeKey(state.origin)) {
      const previous = new URL(state.origin);
      const current = new URL(location.href);
      const previousId = conversationId(state.origin);
      const currentId = conversationId(location.href);
      const sameConversation = previousId && currentId && previousId === currentId;
      const newConversation = !state.routeAdopted && !previousId && currentId && Date.now() - state.started < 15000;
      const userMessages = users();
      const lastUserText = visibleText(userMessages.at(-1));
      const promptStillVisible = !state.routeAdopted && !previousId && lastUserText && lastUserText === state.promptText;
      if (previous.origin === current.origin && (sameConversation || newConversation || promptStillVisible)) {
        state.origin = current.href;
        state.routeAdopted = true;
        state.routePendingAt = null;
      } else {
        if (previous.origin === current.origin && !previousId && !state.routeAdopted && Date.now() - state.started < 15000) {
          state.routePendingAt ??= Date.now();
          if (Date.now() - state.routePendingAt < 3000) return;
        }
        void finish(state, 'incomplete', 'navigation'); return;
      }
    }
    if (Date.now() - state.started > 180000) { void finish(state, 'incomplete', 'timeout_no_text'); return; }
    observeAnswer(state);
    if (state.seenStreaming && !streaming() && hasResponse(state) && Date.now() - state.changed > 2000 &&
        (!state.seenComposerStop || composerReady())) void finish(state, state.ambiguous ? 'incomplete' : 'complete');
    if (!state.seenStreaming && hasResponse(state) &&
        ((responseControls(state) && Date.now() - state.changed > 2000) || Date.now() - state.changed > 10000)) {
      void finish(state, 'incomplete');
    }
  }, 500);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (active && (platform?.stopButton(button) || button?.matches?.('button[data-testid="stop-button"]') ||
        (editor()?.closest?.('form')?.contains?.(button) &&
          /^(Parar|Stop|Stop generating)$/.test(button?.getAttribute?.('aria-label') || '')))) {
      void finish(active, 'incomplete', 'interrupted');
    }
  }, true);
  window.addEventListener('pagehide', () => { if (active) void finish(active, 'incomplete', 'pagehide'); });
})();
