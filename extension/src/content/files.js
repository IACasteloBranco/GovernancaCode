(() => {
  const limit = 20;
  const unavailable = () => ({capture_status: 'unavailable', items: [], truncated: false});

  function fileMetadata(file) {
    const rawName = typeof file?.name === 'string' ? file.name.trim() : '';
    const name = rawName && rawName.length <= 512 && !/[\\/\u0000-\u001f\u007f]/.test(rawName)
      ? rawName : null;
    const rawMime = typeof file?.type === 'string' ? file.type.trim().toLowerCase() : '';
    const mime_type = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(rawMime) && rawMime.length <= 255
      ? rawMime : null;
    const size_bytes = Number.isSafeInteger(file?.size) && file.size >= 0 ? file.size : null;
    return {name, mime_type, size_bytes,
      capture_status: name || mime_type || size_bytes !== null ? 'metadata_only' : 'presence_only',
      source: 'selection_event'};
  }

  function visibleCardMetadata(button) {
    const rawName = button?.getAttribute?.('aria-label')?.trim() || '';
    if (!rawName || /^(?:remover|remove)\s/i.test(rawName)) return null;
    const name = rawName.length <= 512 && !/[\\/\u0000-\u001f\u007f]/.test(rawName) ? rawName : null;
    return name ? {name, mime_type: null, size_bytes: null,
      capture_status: 'metadata_only', source: 'visible_card'} : null;
  }

  function observe(root) {
    if (!root?.querySelectorAll) return unavailable();
    const inputs = [...root.querySelectorAll('input[type="file"]')];
    const files = inputs.flatMap(input => [...(input.files || [])]);
    const cards = [...root.querySelectorAll('[data-composer-attachments] button[aria-label]')]
      .map(visibleCardMetadata).filter(Boolean);
    const items = files.map(fileMetadata);
    const remainingNames = new Map();
    for (const item of items) if (item.name)
      remainingNames.set(item.name, (remainingNames.get(item.name) || 0) + 1);
    for (const card of cards) {
      const count = remainingNames.get(card.name) || 0;
      if (count) remainingNames.set(card.name, count - 1);
      else items.push(card);
    }
    if (!inputs.length && !cards.length) return unavailable();
    return {capture_status: items.length ? 'observed' : 'not_observed',
      items: items.slice(0, limit), truncated: items.length > limit};
  }

  globalThis.GovernancaFiles = {observe};
})();
