(() => {
  const attempts = new Map();
  const recent = [];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const promptCaptureAttribute = 'data-governanca-prompt-capture';
  const editor = () => [...document.querySelectorAll('#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"]')]
    .find(node => !node.getClientRects || node.getClientRects().length);

  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'Falha na captura.');
    return result.data;
  }

  async function promptHash(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim()));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function turnForPrompt(text) {
    const matches = [...document.querySelectorAll('[data-turn-key]')].filter(turn => {
      const user = turn.querySelector('[data-content-search-unit-key$=":user"], [data-message-author-role="user"]');
      return (user?.innerText || user?.textContent || '').trim() === text.trim();
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function markAttempt(state) {
    const attemptId = crypto.randomUUID();
    state.delivered = false;
    attempts.set(attemptId, state);
    if (attempts.size > 8) attempts.delete(attempts.keys().next().value);
    document.documentElement.setAttribute('data-governanca-probe-attempt', attemptId);
    document.documentElement.setAttribute('data-governanca-probe-until', String(Date.now() + 120_000));
    return attemptId;
  }

  globalThis.GovernancaCaptureAttempt = attachmentObservation => {
    const field = editor();
    const text = field?.innerText || field?.value || field?.textContent || '';
    const observation = attachmentObservation || {capture_status: 'unavailable', items: [], truncated: false};
    const hasAttachments = observation.capture_status === 'observed' && observation.items?.length > 0;
    if ((!text.trim() && !hasAttachments) || text.length > 100_000) return;
    const observedAt = new Date().toISOString();
    const url = location.origin + location.pathname;
    const project = /^\/g\/g-p-[a-zA-Z0-9]+(?:\/|$)/.test(location.pathname)
      ? {url, capture_status: 'observed'}
      : {capture_status: 'unknown', reason: 'Projeto não identificado na URL'};
    const state = {promptText: text, conversationUrl: url, confirmed: false};
    state.promptHash = promptHash(text);
    const attemptId = markAttempt(state);
    document.documentElement.setAttribute(promptCaptureAttribute, 'pending');
    recent.push(state);
    if (recent.length > 8) recent.shift();
    state.interaction = send({type: 'capture_prompt', payload: {
      schema_version: '0.1', client_event_id: attemptId, platform: 'chatgpt_web',
      project, conversation: {url, capture_status: 'observed'},
      prompt: {text, capture_status: 'observed'},
      attachments: observation.items || [], attachments_capture_status: observation.capture_status,
      attachments_truncated: observation.truncated === true,
      adapter_version: '0.4.4', observed_at: observedAt
    }}).then(result => {
      document.documentElement.setAttribute(promptCaptureAttribute, 'stored');
      globalThis.GovernancaFiles?.consume?.(observation);
      return result.interaction_id;
    });
    state.interaction.catch(() => {
      document.documentElement.setAttribute(promptCaptureAttribute, 'rejected');
      attempts.delete(attemptId);
      const index = recent.indexOf(state);
      if (index >= 0) recent.splice(index, 1);
      console.warn('[Governança IA] Prompt sem confirmação no backend.');
    });
    return attemptId;
  };

  globalThis.GovernancaCaptureRegeneration = async (text, turnKey) => {
    if (typeof text !== 'string' || !text.trim()) return false;
    const url = location.origin + location.pathname;
    if (!UUID.test(turnKey || '')) return false;
    const matches = recent.filter(item => item.confirmed && item.conversationUrl === url &&
      item.turnKey === turnKey && item.promptText.trim() === text.trim());
    const linked = matches.length === 1 ? {interaction_id: await matches[0].interaction,
      prompt_hash: await matches[0].promptHash} :
      await send({type: 'lookup_turn', conversationUrl: url, turnKey});
    if (!linked?.interaction_id || linked.prompt_hash !== await promptHash(text)) return false;
    markAttempt({interaction: Promise.resolve(linked.interaction_id), promptText: text,
      promptHash: Promise.resolve(linked.prompt_hash), turnKey, conversationUrl: url});
    return true;
  };

  window.addEventListener('governanca-ai-network-capture', event => {
    const {attemptId, text, captureStatus} = event.detail || {};
    const state = attempts.get(attemptId);
    if (!UUID.test(attemptId || '') || !state || state.delivered ||
        typeof text !== 'string' || !text || text.length > 100_000 ||
        !['complete', 'incomplete'].includes(captureStatus)) return;
    state.delivered = true;
    void state.interaction.then(interactionId => send({type: 'capture_response', interactionId,
      payload: {client_event_id: attemptId, text, capture_status: captureStatus,
        observed_at: new Date().toISOString(), adapter_version: '0.4.4'}
    })).then(async () => {
      state.confirmed = true;
      state.conversationUrl = location.origin + location.pathname;
      const turn = turnForPrompt(state.promptText);
      const turnKey = turn?.getAttribute('data-turn-key');
      if (turnKey) {
        state.turnKey = turnKey;
        await send({type: 'remember_turn', conversationUrl: state.conversationUrl,
          turnKey, interactionId: await state.interaction, promptHash: await state.promptHash});
      }
    }).catch(() => console.warn('[Governança IA] Resposta sem confirmação no backend.'))
      .finally(() => attempts.delete(attemptId));
  });
})();
