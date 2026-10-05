(() => {
  const INSTALLED = Symbol.for('governanca.ai.network.probe.v1');
  if (window[INSTALLED]) return;
  window[INSTALLED] = true;

  const MARKER = 'governanca-ai-network-probe-v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eventCounts = new Map();
  let nextRequestId = 0;

  function activeAttempt() {
    const root = document.documentElement;
    const id = root?.getAttribute('data-governanca-probe-attempt');
    const until = Number(root?.getAttribute('data-governanca-probe-until'));
    return UUID.test(id || '') && Number.isFinite(until) && Date.now() <= until ? id : null;
  }

  function safeTarget(input) {
    try {
      const url = new URL(typeof input === 'string' ? input : input?.url || String(input), location.href);
      const expected = new URL(location.href);
      if (url.protocol === 'wss:') url.protocol = 'https:';
      if (url.protocol === 'ws:') url.protocol = 'http:';
      if (url.origin !== expected.origin) return null;
      const knownSegments = new Set(['backend-api', 'conversation', 'prepare', 'batch', 'finalize',
        'sentinel', 'models', 'accounts', 'conversations', 'messages', 'feedback', 'files', 'upload']);
      const path = url.pathname.split('/').map(part =>
        knownSegments.has(part) ? part : part ? ':id' : ''
      ).join('/').slice(0, 240);
      return path || '/';
    } catch { return null; }
  }

  function emit(attemptId, transport, phase, details = {}) {
    if (!attemptId) return;
    const count = eventCounts.get(attemptId) || 0;
    if (count >= 80) return;
    eventCounts.set(attemptId, count + 1);
    if (eventCounts.size > 20) eventCounts.delete(eventCounts.keys().next().value);
    try {
      window.postMessage({marker: MARKER, attemptId, transport, phase, at: Date.now(), ...details}, location.origin);
    } catch { /* A sonda nunca interfere na aplicação. */ }
  }

  const mime = value => String(value || '').split(';', 1)[0].trim().toLowerCase().slice(0, 80);
  const methodOf = value => String(value || 'GET').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
  const elapsed = start => Math.max(0, Math.round(performance.now() - start));

  async function inspectConversation(response, attemptId, requestId, path) {
    if (!response?.body || typeof TextDecoder !== 'function') return;
    let reader;
    try { reader = response.clone().body.getReader(); }
    catch { return; }
    const decoder = new TextDecoder();
    const types = new Map();
    const shapes = new Map();
    const lastEvents = [];
    const eventSequence = [];
    let bytes = 0;
    let chunks = 0;
    let frames = 0;
    let doneMarkers = 0;
    let truncated = false;
    let pending = '';
    const streamStarted = performance.now();
    const knownLabels = new Set(['message', 'delta', 'ping', 'done', 'error', 'completion',
      'response', 'response.created', 'response.completed', 'response.output_text.delta',
      'assistant', 'tool', 'finished_successfully', 'in_progress', 'streaming',
      'complete', 'completed', 'stop', 'length', 'interrupted', 'aborted', 'failed']);
    const label = value => typeof value === 'string' ? (knownLabels.has(value) ? value : 'other') : null;
    const summary = () => ({requestId, path, bytes, chunks, frames, doneMarkers,
      protocolDone: doneMarkers > 0, truncated,
      streamElapsedMs: elapsed(streamStarted),
      eventTypes: [...types].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name}=${count}`),
      eventShapes: [...shapes].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name}=${count}`),
      lastEvents, eventSequence});
    function shapeOf(parsed) {
      if (!parsed || typeof parsed !== 'object') return 'primitive';
      if (Array.isArray(parsed)) return 'array';
      const keys = ['type', 'message', 'delta', 'v', 'p', 'o', 'content', 'status', 'error', 'is_completion']
        .filter(key => Object.hasOwn(parsed, key));
      const content = parsed.message?.content || parsed.content;
      const parts = content?.parts;
      const patchPath = typeof parsed.p === 'string' ?
        /(?:^|\/)content\/parts(?:\/|$)/.test(parsed.p) ? 'parts' :
        /(?:^|\/)status(?:\/|$)/.test(parsed.p) ? 'status' :
        /(?:^|\/)metadata(?:\/|$)/.test(parsed.p) ? 'metadata' :
        /(?:^|\/)content(?:\/|$)/.test(parsed.p) ? 'content' : 'other' : null;
      const valueType = Object.hasOwn(parsed, 'v') ?
        Array.isArray(parsed.v) ? 'array' : parsed.v === null ? 'null' : typeof parsed.v : null;
      const valueKeys = parsed.v && typeof parsed.v === 'object' && !Array.isArray(parsed.v) ?
        ['message', 'content', 'parts', 'status', 'metadata', 'type', 'delta', 'author']
          .filter(key => Object.hasOwn(parsed.v, key)) : [];
      const partType = Array.isArray(parts) ?
        parts.length ? typeof parts[0] : 'empty' : null;
      const operation = typeof parsed.o === 'string' ?
        ['add', 'append', 'replace', 'remove', 'patch'].includes(parsed.o) ? parsed.o : 'other' : null;
      return [`keys-${keys.join('_') || 'other'}`, patchPath && `path-${patchPath}`,
        operation && `op-${operation}`, valueType && `value-${valueType}`,
        valueKeys.length && `vkeys-${valueKeys.join('_')}`, partType && `part-${partType}`]
        .filter(Boolean).join(':').slice(0, 180);
    }
    function observe(frame) {
      if (!frame.trim()) return;
      frames++;
      const lines = frame.split(/\r?\n/);
      const eventName = label(lines.find(line => line.startsWith('event:'))?.slice(6).trim()) || 'message';
      const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data === '[DONE]') doneMarkers++;
      let payloadType = null;
      let status = null;
      let finish = null;
      let shape = 'unparsed';
      if (data && data !== '[DONE]' && data.length <= 65536) {
        try {
          const parsed = JSON.parse(data);
          payloadType = label(parsed?.type);
          status = label(parsed?.status || parsed?.message?.status);
          finish = label(parsed?.message?.metadata?.finish_details?.type);
          shape = shapeOf(parsed);
          shapes.set(shape, (shapes.get(shape) || 0) + 1);
        } catch { /* O formato ainda não foi identificado. */ }
      }
      const kind = [eventName, payloadType, status, finish].filter(Boolean).join(':').slice(0, 180);
      types.set(kind, (types.get(kind) || 0) + 1);
      lastEvents.push(kind);
      if (lastEvents.length > 8) lastEvents.shift();
      if (eventSequence.length < 32) eventSequence.push(`${kind}--${shape}`.slice(0, 200));
    }
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks++;
        bytes += value?.byteLength || 0;
        if (bytes > 4_000_000) { truncated = true; continue; }
        pending = (pending + decoder.decode(value, {stream: true})).replace(/\r\n/g, '\n');
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) >= 0) {
          observe(pending.slice(0, boundary));
          pending = pending.slice(boundary + 2);
        }
        if (pending.length > 131072) { pending = ''; truncated = true; }
      }
      if (!truncated) {
        pending += decoder.decode();
        if (pending.trim()) observe(pending);
      }
      emit(attemptId, 'fetch', 'stream_summary', {...summary(), readerDone: true});
    } catch (error) {
      const allowedErrors = new Set(['AbortError', 'TypeError', 'NetworkError', 'TimeoutError', 'InvalidStateError']);
      emit(attemptId, 'fetch', 'stream_error', {...summary(), readerDone: false,
        errorKind: allowedErrors.has(error?.name) ? error.name : 'other'});
    }
  }

  if (typeof window.fetch === 'function') {
    const nativeFetch = window.fetch;
    window.fetch = new Proxy(nativeFetch, {
      apply(target, thisArg, args) {
        const attemptId = activeAttempt();
        const path = attemptId ? safeTarget(args[0]) : null;
        const method = methodOf(args[1]?.method || args[0]?.method);
        const requestId = ++nextRequestId;
        const start = performance.now();
        const candidate = Boolean(path && method !== 'GET');
        if (candidate) emit(attemptId, 'fetch', 'start', {requestId, path, method});
        let result;
        try { result = Reflect.apply(target, thisArg, args); }
        catch (error) {
          if (candidate) emit(attemptId, 'fetch', 'error', {requestId, path, method, elapsedMs: elapsed(start)});
          throw error;
        }
        if (path) Promise.resolve(result).then(response => {
          const contentType = mime(response?.headers?.get?.('content-type'));
          if (candidate || contentType === 'text/event-stream') {
            emit(attemptId, 'fetch', 'end', {requestId, path, method, status: response?.status,
              contentType, hasBody: Boolean(response?.body), elapsedMs: elapsed(start)});
          }
          if (candidate && /(?:^|\/)conversation$/.test(path) && response?.ok && response?.body) {
            void inspectConversation(response, attemptId, requestId, path);
          }
        }, () => {
          if (candidate) emit(attemptId, 'fetch', 'error', {requestId, path, method, elapsedMs: elapsed(start)});
        });
        return result;
      }
    });
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;
    const requests = new WeakMap();
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      requests.set(this, {method: methodOf(method), path: safeTarget(url)});
      return Reflect.apply(nativeOpen, this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      const info = requests.get(this);
      const attemptId = activeAttempt();
      if (attemptId && info?.path) {
        const requestId = ++nextRequestId;
        const start = performance.now();
        const candidate = info.method !== 'GET';
        if (candidate) emit(attemptId, 'xhr', 'start', {requestId, path: info.path, method: info.method});
        this.addEventListener('loadend', () => {
          let contentType = '';
          try { contentType = mime(this.getResponseHeader('content-type')); } catch { /* ignore */ }
          if (candidate || contentType === 'text/event-stream') {
            emit(attemptId, 'xhr', 'end', {requestId, path: info.path, method: info.method,
              status: this.status, contentType, elapsedMs: elapsed(start)});
          }
        }, {once: true});
      }
      return Reflect.apply(nativeSend, this, args);
    };
  }

  if (typeof window.EventSource === 'function') {
    window.EventSource = new Proxy(window.EventSource, {
      construct(target, args, newTarget) {
        const source = Reflect.construct(target, args, newTarget);
        const path = safeTarget(args[0]);
        if (path) {
          const requestId = ++nextRequestId;
          const firstByAttempt = new Set();
          source.addEventListener('open', () => emit(activeAttempt(), 'eventsource', 'open', {requestId, path}));
          source.addEventListener('message', () => {
            const attemptId = activeAttempt();
            if (attemptId && !firstByAttempt.has(attemptId)) {
              firstByAttempt.add(attemptId);
              emit(attemptId, 'eventsource', 'message_seen', {requestId, path});
            }
          });
          source.addEventListener('error', () => emit(activeAttempt(), 'eventsource', 'error', {requestId, path}));
        }
        return source;
      }
    });
  }

  if (typeof window.WebSocket === 'function') {
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(target, args, newTarget) {
        const socket = Reflect.construct(target, args, newTarget);
        const path = safeTarget(args[0]);
        if (path) {
          const requestId = ++nextRequestId;
          const firstByAttempt = new Set();
          socket.addEventListener('open', () => emit(activeAttempt(), 'websocket', 'open', {requestId, path}));
          socket.addEventListener('message', () => {
            const attemptId = activeAttempt();
            if (attemptId && !firstByAttempt.has(attemptId)) {
              firstByAttempt.add(attemptId);
              emit(attemptId, 'websocket', 'first_message_seen', {requestId, path});
            }
          });
          socket.addEventListener('close', event => emit(activeAttempt(), 'websocket', 'close',
            {requestId, path, closeCode: event.code}));
        }
        return socket;
      }
    });
  }
})();
