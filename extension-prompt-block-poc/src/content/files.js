(() => {
  const limit = 20;
  let pending = [];
  let pendingAt = 0;
  const fileMetadata = file => ({
    name: clipped(file?.name, 512), mime_type: clipped(file?.type, 255),
    size_bytes: Number.isSafeInteger(file?.size) && file.size >= 0 ? file.size : null,
    capture_status: 'metadata_only', source: 'selection_event'
  });
  const hasEditor = () => Boolean(document.querySelector('[contenteditable="true"].ProseMirror, [data-testid="chat-input"] [contenteditable="true"], #prompt-textarea')) ||
    [...document.querySelectorAll('[contenteditable="true"], textarea')]
      .filter(node => visible(node) && !node.closest?.('pre, code, .monaco-editor, .cm-editor')).length === 1;
  const remember = files => {
    if (!hasEditor()) return;
    const selected = [...files].slice(0, limit + 1);
    const remembered = new Map(pending.map(item => [`${item.name}:${item.size_bytes}:${item.mime_type}`, item]));
    for (const item of selected.map(fileMetadata))
      remembered.set(`${item.name}:${item.size_bytes}:${item.mime_type}`, item);
    pending = [...remembered.values()].slice(0, limit + 1);
    pendingAt = Date.now();
  };
  document.addEventListener('change', event => {
    if (event.target?.matches?.('input[type="file"]')) remember(event.target.files || []);
  }, true);
  document.addEventListener('drop', event => {
    if (event.dataTransfer?.files?.length) remember(event.dataTransfer.files);
  }, true);
  document.addEventListener('paste', event => {
    if (event.clipboardData?.files?.length && event.target?.closest?.('[contenteditable="true"], textarea'))
      remember(event.clipboardData.files);
  }, true);
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button[aria-label]');
    if (/^(Remove|Delete|Remover|Excluir)(?: file| attachment| arquivo| anexo)?$/i.test(button?.getAttribute?.('aria-label') || ''))
      pending = [];
  }, true);
  const visible = node => !node?.getClientRects || node.getClientRects().length > 0;
  const attr = (node, key) => node?.getAttribute?.(key) || null;
  const clipped = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
  const attachmentSelector = '[data-file-name], [data-testid="attachment"], [data-testid="file-upload"], [data-testid="file-thumbnail"]';
  const imageSelector = 'img[src^="blob:"], img[alt$=".png" i], img[alt$=".jpg" i], img[alt$=".jpeg" i], img[alt$=".webp" i], .cds-card-body img';
  const artifactSelector = '[data-artifact-id], [data-testid="artifact-button"], [data-testid="artifact-block"]';
  const downloadable = node => {
    if (node.hasAttribute?.('download')) return true;
    const href = attr(node, 'href') || '';
    if (href.startsWith('sandbox:/mnt/data/')) return true;
    try {
      const url = new URL(href, location.href);
      return url.origin === new URL(location.href).origin &&
        /^\/backend-api\/files\/[^/]+\/download$/.test(url.pathname);
    } catch { return false; }
  };
  function observe(root, generated = false) {
    if (!root?.querySelectorAll) return {capture_status: 'unavailable', items: [], truncated: false};
    const cards = [...root.querySelectorAll(generated ? `${attachmentSelector}, ${artifactSelector}` : `${attachmentSelector}, ${imageSelector}`)];
    const controls = generated ? [...root.querySelectorAll('a, button')].filter(node =>
      downloadable(node) || /^(Download|Download file|Baixar|Baixar arquivo)$/.test(attr(node, 'aria-label') || '')) : [];
    const candidates = [...new Set([...cards, ...controls])].filter(node => visible(node) && !node.closest?.('pre, code'));
    const nodes = candidates.filter(node => !candidates.some(parent => parent !== node && parent.contains?.(node)));
    // FileList supplies metadata only for a file that still has a visible card.
    // Never read bytes, retain File objects, or equate selection with submission.
    const selected = generated ? [] : [...root.querySelectorAll('input[type="file"]')].flatMap(input => [...(input.files || [])]);
    const items = nodes.slice(0, limit).map(node => {
      const download = downloadable(node) ? node : [...(node.querySelectorAll?.('a') || [])].find(downloadable);
      const filenameText = (download?.textContent || node.textContent || '').trim();
      const name = clipped(attr(node, 'data-file-name') || attr(node, 'download') ||
        (node.matches?.('img') ? attr(node, 'alt') : null) ||
        node.querySelector?.('[data-file-name]')?.getAttribute('data-file-name') ||
        node.querySelector?.('[data-testid="file-name"]')?.textContent || attr(download, 'download') ||
        (/^[^\r\n/\\]{1,500}\.[a-zA-Z0-9]{1,10}$/.test(filenameText) ? filenameText : null), 512);
      const file = name ? selected.find(item => item.name === name) : null;
      const mime_type = clipped(file?.type || attr(node, 'data-mime-type'), 255);
      const size_bytes = Number.isSafeInteger(file?.size) && file.size >= 0 ? file.size : null;
      return {name, mime_type, size_bytes, capture_status: name || mime_type || size_bytes !== null ? 'metadata_only' : 'presence_only', source: 'visible_card'};
    });
    if (!generated && !items.length && pending.length && Date.now() - pendingAt < 300000)
      return {capture_status: 'observed', items: pending.slice(0, limit), truncated: pending.length > limit};
    return {capture_status: nodes.length ? 'observed' : 'not_observed', items, truncated: nodes.length > limit};
  }
  globalThis.GovernancaFiles = {observe, commit: () => { pending = []; }};
})();
