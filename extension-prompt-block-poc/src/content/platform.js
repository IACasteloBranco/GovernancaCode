(() => {
  const claude = new URL(location.href).origin === 'https://claude.ai';
  const visible = node => !node?.getClientRects || node.getClientRects().length > 0;
  const editor = () => {
    const known = [...document.querySelectorAll(
    claude ? '[contenteditable="true"].ProseMirror, [data-testid="chat-input"] [contenteditable="true"]'
      : '#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"]'
    )].find(visible);
    if (known || !claude) return known || null;
    const candidates = [...document.querySelectorAll('[contenteditable="true"], textarea')]
      .filter(node => visible(node) && !node.disabled && !node.readOnly &&
        !node.closest?.('pre, code, .monaco-editor, .cm-editor, [data-artifact-id]'));
    // A unique editable field is safe to recognize without a provider CSS class.
    return candidates.length === 1 ? candidates[0] : null;
  };
  const composer = () => {
    const field = editor();
    const known = field?.closest?.('form') || (claude ? field?.closest?.('[data-testid="chat-input"]') : null);
    if (known || !claude) return known;
    // Claude can render the composer without a form. Keep the search local.
    let parent = field?.parentElement;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      if (parent.matches?.('main, body, html')) break;
      if ([...(parent.querySelectorAll?.('button') || [])].some(node =>
        /^(Send|Send message|Enviar|Enviar mensagem|Stop response|Stop generating|Parar|Interromper resposta)$/i.test(label(node)))) return parent;
    }
    return null;
  };
  const fileRoot = () => {
    const base = composer();
    if (!claude || !base) return base;
    let parent = base.parentElement;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      if (parent.matches?.('main, body, html, [data-testid="user-message"], [data-testid="assistant-message"]')) break;
      const preview = [...(parent.querySelectorAll?.('[data-file-name], [data-testid="attachment"], [data-testid="file-upload"], [data-testid="file-thumbnail"], img[src^="blob:"], img[alt$=".png" i], img[alt$=".jpg" i], img[alt$=".jpeg" i], img[alt$=".webp" i], .cds-card-body img') || [])]
        .some(node => !node.closest?.('[data-testid="user-message"], [data-testid="assistant-message"], .font-claude-response'));
      if (preview) return parent;
    }
    return base;
  };
  const label = node => (node?.getAttribute?.('aria-label') || '').trim();
  const sendButton = node => Boolean(node && visible(node) && !stopButton(node) && (
    node.matches?.('button[data-testid="send-button"]') ||
    (claude && /^(Send message|Enviar mensagem)$/i.test(label(node))) ||
    (composer()?.contains(node) && ((node.type === 'submit' && editor()?.closest?.('form')?.contains(node)) || /^(Send|Enviar)$/i.test(label(node))))));
  const stopButton = node => Boolean(node && visible(node) && (
    node.matches?.('button[data-testid="stop-button"]') ||
    /^(Stop|Parar|Stop generating|Stop response|Interromper resposta)$/i.test(label(node))));
  const role = node => node?.matches?.('[data-testid="user-message"]') ? 'user'
    : node?.matches?.('.font-claude-response, [data-testid="assistant-message"]') ? 'assistant' : null;
  const messages = () => [...document.querySelectorAll(
    '[data-testid="user-message"], .font-claude-response, [data-testid="assistant-message"]'
  )].filter((node, _, all) => !all.some(parent => parent !== node && parent.contains(node)));
  globalThis.GovernancaPlatform = {claude, editor, composer, fileRoot, sendButton, stopButton, role, messages,
    streaming: () => [...document.querySelectorAll('button')].some(stopButton),
    ready: () => [...document.querySelectorAll('button')].some(sendButton)};
})();
