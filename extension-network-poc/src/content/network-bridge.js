(() => {
  const MARKER = 'governanca-ai-network-probe-v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const TRANSPORTS = new Set(['fetch', 'xhr', 'eventsource', 'websocket']);
  const PHASES = new Set(['start', 'end', 'error', 'open', 'message_seen', 'first_message_seen', 'close', 'stream_summary', 'stream_error']);
  const countByAttempt = new Map();

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.marker !== MARKER || !UUID.test(data.attemptId || '')) return;
    if (!TRANSPORTS.has(data.transport) || !PHASES.has(data.phase)) return;
    if (typeof data.path !== 'string' || !/^\/[a-zA-Z0-9/._:~\-]{0,239}$/.test(data.path)) return;
    const count = countByAttempt.get(data.attemptId) || 0;
    if (count >= 80) return;
    countByAttempt.set(data.attemptId, count + 1);
    if (countByAttempt.size > 20) countByAttempt.delete(countByAttempt.keys().next().value);

    const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
    const contentType = typeof data.contentType === 'string' && /^[a-z0-9.+\-]+\/[a-z0-9.+\-]+$/.test(data.contentType)
      ? data.contentType.slice(0, 80) : '';
    const labels = (values, limit = 8) => Array.isArray(values) ? values.slice(0, limit).filter(value =>
      typeof value === 'string' && /^[a-zA-Z0-9_.:=-]{1,200}$/.test(value)) : [];
    const metadata = {
      type: 'probe_metadata', attemptId: data.attemptId,
      transport: data.transport, phase: data.phase, path: data.path,
      method: typeof data.method === 'string' && /^[A-Z]{1,12}$/.test(data.method) ? data.method : null,
      requestId: integer(data.requestId),
      status: integer(data.status),
      elapsedMs: integer(data.elapsedMs),
      closeCode: integer(data.closeCode),
      contentType,
      hasBody: data.hasBody === true,
      bytes: integer(data.bytes), chunks: integer(data.chunks), frames: integer(data.frames),
      doneMarkers: integer(data.doneMarkers), truncated: data.truncated === true,
      protocolDone: data.protocolDone === true, readerDone: data.readerDone === true,
      streamElapsedMs: integer(data.streamElapsedMs),
      errorKind: ['AbortError', 'TypeError', 'NetworkError', 'TimeoutError', 'InvalidStateError', 'other'].includes(data.errorKind) ? data.errorKind : null,
      eventTypes: labels(data.eventTypes), eventShapes: labels(data.eventShapes),
      lastEvents: labels(data.lastEvents), eventSequence: labels(data.eventSequence, 32)
    };
    chrome.runtime.sendMessage(metadata).catch(() => {});
  });
})();
