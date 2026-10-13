(() => {
  const platform = globalThis.GovernancaPlatform;
  const errorMessage = error => {
    const detail = String(error?.message || error || 'Erro desconhecido');
    if (/Extension context invalidated|Receiving end does not exist|message port closed/i.test(detail)) {
      return 'Conexão da extensão perdida. Recarregue a aba do ChatGPT.';
    }
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
        const detail = error.originalMessage || error.message || '';
        const transient = /Receiving end does not exist|message port closed|Sem resposta do service worker|Failed to fetch|TimeoutError/i.test(detail);
        if (!transient || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, [1000, 3000, 8000][attempt]));
      }
    }
  };
  chrome.runtime.onMessage?.addListener((message, _sender, reply) => {
    if (message?.type !== 'governanca_probe_observer') return;
    const editable = [...document.querySelectorAll('#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"]')];
    reply({active: true, platform: 'chatgpt_web', editor_found: Boolean(editor()),
      send_found: platform ? [...document.querySelectorAll('button')].some(button => platform.sendButton(button))
        : Boolean(document.querySelector('button[data-testid="send-button"]')),
      editable_count: editable.length});
  });
  const roleOf = node => node?.getAttribute?.('data-message-author-role') || node?.getAttribute?.('data-conversation-role') ||
    node?.querySelector?.('[data-conversation-role]')?.getAttribute('data-conversation-role') || null;
  const messages = () => {
    const searchUnits = [...document.querySelectorAll('[data-content-search-unit-key]')].filter(node =>
      roleOf(node) === 'user' || roleOf(node) === 'assistant');
    if (searchUnits.length) return searchUnits;
    const candidates = [...document.querySelectorAll('[data-message-author-role], [data-conversation-role]')];
    const nodes = candidates.length ? candidates : [...document.querySelectorAll('[data-message-author-role]')];
    return nodes.filter(node => !nodes.some(parent => parent !== node && parent.contains?.(node)));
  };
  const answers = () => {
    const current = messages();
    return current.length ? current.filter(node => roleOf(node) === 'assistant')
      : [...document.querySelectorAll('[data-message-author-role="assistant"], [data-conversation-role="assistant"]')];
  };
  const users = () => {
    const current = messages();
    return current.length ? current.filter(node => roleOf(node) === 'user')
      : [...document.querySelectorAll('[data-message-author-role="user"], [data-conversation-role="user"]')];
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
  const conversationId = href => new URL(href).pathname.match(/(?:^|\/)c\/([^/]+)/)?.[1] || null;
  const streaming = () => Boolean(platform?.streaming?.() || document.querySelector('button[data-testid="stop-button"]'));
  const editor = () => platform?.editor?.() || document.querySelector('#prompt-textarea') ||
    document.querySelector('[data-testid="prompt-textarea"]') ||
    document.querySelector('form [contenteditable="true"]');
  let active = null;
  let lastAttempt = 0;
  const pendingNetworkCandidates = new Map();
  const acceptNetworkCandidate = (state, candidate) => {
    if (state.networkCandidate && state.networkCandidate.text !== candidate.text) {
      state.networkAmbiguous = true;
      state.networkCandidate = null;
      return;
    }
    state.networkCandidate = {text: candidate.text, requestId: candidate.requestId};
  };
  window.addEventListener('governanca-ai-network-capture', event => {
    const candidate = event.detail;
    if (!candidate || typeof candidate.attemptId !== 'string' ||
        candidate.protocolDone !== true || typeof candidate.text !== 'string' ||
        !candidate.text.trim() || candidate.text.length > 100000) return;
    if (active?.clientEventId === candidate.attemptId) {
      acceptNetworkCandidate(active, candidate);
    } else {
      const pending = pendingNetworkCandidates.get(candidate.attemptId);
      if (pending && pending.text !== candidate.text) pendingNetworkCandidates.set(candidate.attemptId, {ambiguous: true});
      else pendingNetworkCandidates.set(candidate.attemptId, {text: candidate.text, requestId: candidate.requestId});
      if (pendingNetworkCandidates.size > 2) pendingNetworkCandidates.delete(pendingNetworkCandidates.keys().next().value);
      setTimeout(() => pendingNetworkCandidates.delete(candidate.attemptId), 30000);
    }
  });
  const responseControls = state => Boolean(state.answerNode?.hasAttribute?.('data-content-search-unit-key') &&
    state.answerNode.closest?.('[data-turn-key]')?.querySelector?.('.turn-action-controls'));

  function observeAnswer(state) {
    const orderedMessages = messages();
    const latestUserIndex = orderedMessages.findLastIndex(node =>
      roleOf(node) === 'user');
    if (latestUserIndex >= 0 && visibleText(orderedMessages[latestUserIndex]) === state.promptText) {
      const followingAnswers = orderedMessages.slice(latestUserIndex + 1).filter(node =>
        roleOf(node) === 'assistant');
      if (followingAnswers.length > 1) state.ambiguous = true;
      const answer = followingAnswers.slice().reverse().find(node => visibleText(node));
      const text = visibleText(answer);
      if (text) state.answerNode = answer;
      if (text && text !== state.text) {
        state.text = text; state.changed = Date.now();
        if (!state.answerReported) { state.answerReported = true; void send({type: 'capture_diagnostic', attemptId: state.clientEventId, stage: 'answer_found', answerChars: text.length}).catch(() => {}); }
      }
      if (streaming()) state.seenStreaming = true;
      return;
    }
    const currentAnswers = answers();
    if (currentAnswers.length < state.baselineCount) state.baselineCount = currentAnswers.length;
    const candidates = currentAnswers.slice(state.baselineCount);
    if (candidates.length > 1) state.ambiguous = true;
    let answer = candidates.slice().reverse().find(node => visibleText(node));
    let text = visibleText(answer);
    // A página pode trocar mensagens antigas por novas mantendo o mesmo número de elementos.
    if (!text && currentAnswers.length === state.baselineCount) {
      const latestText = visibleText(currentAnswers.at(-1));
      if (latestText && latestText !== state.baselineLastText) {
        answer = currentAnswers.at(-1);
        text = latestText;
      }
    }
    if (text) state.answerNode = answer;
    if (text && text !== state.text) {
      state.text = text; state.changed = Date.now();
      if (!state.answerReported) { state.answerReported = true; void send({type: 'capture_diagnostic', attemptId: state.clientEventId, stage: 'answer_found', answerChars: text.length}).catch(() => {}); }
    }
    if (streaming()) state.seenStreaming = true;
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

  async function finish(state, status, reason = 'no_text') {
    if (state.done) return;
    state.done = true;
    if (active === state) active = null;
    const diagnostics = !state.text.trim() ? captureDiagnostics(state) : null;
    try {
      const id = await state.delivery;
      if (!state.text.trim()) {
        await send({type: 'capture_failed', id, reason, diagnostics});
        return;
      }
      const networkMatched = !state.ambiguous && !state.networkAmbiguous && state.networkCandidate?.text === state.text.trim();
      void send({type: 'capture_diagnostic', attemptId: state.clientEventId, stage: 'finalizing', answerChars: state.text.length}).catch(() => {});
      try { await send({type: 'network_capture_result', attemptId: state.clientEventId, matched: networkMatched}); }
      catch { /* Diagnóstico comparativo não pode impedir a entrega da resposta. */ }
      await responseDelivery({type: 'response', id, payload: {
        client_event_id: crypto.randomUUID(), text: networkMatched ? state.networkCandidate.text : state.text,
        capture_status: status, observed_at: new Date().toISOString(), adapter_version: '0.3.2-network'
      }});
    } catch (error) {
      void send({type: 'capture_diagnostic', attemptId: state.clientEventId, stage: 'delivery_error', answerChars: state.text.length}).catch(() => {});
      console.warn('[Governança IA] Resposta sem confirmação de entrega:', errorMessage(error));
    }
  }

  async function attempt() {
    const field = editor();
    const text = field?.innerText || field?.value || field?.textContent || '';
    if (!field) { console.warn('[Governança IA] Campo do prompt não encontrado após o envio.'); return; }
    if (!text.trim() || Date.now() - lastAttempt < 500) return;
    lastAttempt = Date.now();
    const clientEventId = crypto.randomUUID();
    document.documentElement?.setAttribute('data-governanca-probe-attempt', clientEventId);
    document.documentElement?.setAttribute('data-governanca-probe-until', String(Date.now() + 180000));
    const origin = location.href;
    const baselineAnswers = answers();
    const baselineCount = baselineAnswers.length;
    const baselineLastText = visibleText(baselineAnswers.at(-1));
    try {
      const config = await send({type: 'status'});
      if (!config.enabled) return;
      if (active) {
        observeAnswer(active);
        void finish(active, active.seenStreaming && !streaming() && !active.ambiguous ? 'complete' : 'incomplete', 'new_prompt');
      }
      const state = {clientEventId, origin, baselineCount, baselineLastText, promptText: text.trim(), text: '', started: Date.now(), changed: Date.now(), seenStreaming: false, routeAdopted: false, routePendingAt: null, ambiguous: false, networkAmbiguous: false, networkCandidate: null, done: false};
      active = state;
      const pendingCandidate = pendingNetworkCandidates.get(clientEventId);
      if (pendingCandidate?.ambiguous) state.networkAmbiguous = true;
      else if (pendingCandidate) acceptNetworkCandidate(state, pendingCandidate);
      pendingNetworkCandidates.delete(clientEventId);
      void send({type: 'capture_diagnostic', attemptId: clientEventId, stage: 'started', answerChars: 0}).catch(() => {});
      state.delivery = send({type: 'prompt', payload: {
        client_event_id: clientEventId, observed_at: new Date().toISOString(),
        project: {capture_status: 'unknown', reason: 'Projeto não identificado com segurança pelo adapter inicial'},
        conversation: {url: origin, capture_status: 'observed'},
        prompt: {text, capture_status: 'observed'},
        ...(globalThis.GovernancaFiles ? (() => {
          const observation = globalThis.GovernancaFiles.observe(platform?.fileRoot?.() || platform?.composer?.() || editor(), false);
          return {attachments: observation.items || [], attachments_capture_status: observation.capture_status,
            attachments_truncated: observation.truncated === true};
        })() : {})
      }}).then(result => result.interaction_id);
      state.delivery.catch(error => console.warn('[Governança IA] Prompt sem confirmação de entrega:', errorMessage(error)));
    } catch (error) { console.warn('[Governança IA] Captura indisponível:', errorMessage(error)); }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    const form = editor()?.closest?.('form');
    if (platform?.sendButton?.(button) || button?.matches?.('button[data-testid="send-button"]') ||
        (form?.contains(button) && button?.type === 'submit')) void attempt();
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
    if (!state.ambiguous && !state.networkAmbiguous && state.networkCandidate?.text === state.text.trim() &&
        state.text && Date.now() - state.changed > 500) {
      void finish(state, 'complete', 'network_done'); return;
    }
    if (state.seenStreaming && !streaming() && state.text && Date.now() - state.changed > 2000) void finish(state, state.ambiguous ? 'incomplete' : 'complete');
    if (!state.seenStreaming && state.text &&
        ((responseControls(state) && Date.now() - state.changed > 2000) || Date.now() - state.changed > 10000)) {
      void finish(state, 'incomplete');
    }
  }, 500);
  document.addEventListener('click', event => {
    if (active && event.target.closest?.('button[data-testid="stop-button"]')) void finish(active, 'incomplete', 'interrupted');
  }, true);
  window.addEventListener('pagehide', () => { if (active) void finish(active, 'incomplete', 'pagehide'); });
})();
