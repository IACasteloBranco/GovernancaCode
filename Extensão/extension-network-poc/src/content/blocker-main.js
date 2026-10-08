(() => {
  const installed = Symbol.for('governanca.ai.prompt.block.v1');
  if (window[installed]) return;
  window[installed] = true;
  if (typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch;
  const marker = 'governanca-ai-prompt-block-v1';
  const conversationPath = /^\/backend-api\/(?:[^/]+\/)*conversation\/?$/;
  const claudeCompletionPath = /^\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/completion\/?$/;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin ||
        event.data?.marker !== marker || event.data.phase !== 'ping') return;
    window.postMessage({marker, phase: 'pong', blocked:
      document.documentElement?.getAttribute('data-governanca-block-prompts') !== 'allow'}, location.origin);
  });
  window.fetch = new Proxy(originalFetch, {
    apply(target, thisArg, args) {
      let candidate = false;
      try {
        const input = args[0];
        const url = new URL(typeof input === 'string' ? input : input?.url || String(input), location.href);
        const method = String(args[1]?.method || input?.method || 'GET').toUpperCase();
        candidate = url.origin === location.origin && method === 'POST' &&
          (location.origin === 'https://claude.ai' ? claudeCompletionPath : conversationPath).test(url.pathname);
      } catch { /* Deixar a própria aplicação tratar entradas inválidas. */ }
      if (!candidate) return Reflect.apply(target, thisArg, args);
      const root = document.documentElement;
      const allowed = root?.getAttribute('data-governanca-block-prompts') === 'allow';
      const expiresAt = Number(root?.getAttribute('data-governanca-allow-until'));
      const validGrant = allowed && Date.now() <= expiresAt;
      if (validGrant) {
        root.setAttribute('data-governanca-block-prompts', 'block');
        root.removeAttribute('data-governanca-allow-until');
        return Reflect.apply(target, thisArg, args);
      }
      try { window.postMessage({marker, phase: 'network_blocked', reason: allowed && Date.now() > expiresAt ? 'expired' : 'missing'}, location.origin); } catch { /* diagnóstico opcional */ }
      return Promise.reject(new DOMException('Envio bloqueado pela Governança IA.', 'AbortError'));
    }
  });
})();
