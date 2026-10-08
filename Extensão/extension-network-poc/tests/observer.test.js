import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/observer.js', import.meta.url), 'utf8');
const interactionId = '5e9585f9-61fe-4e15-ba85-93f3451ae7d7';

function setup(initialUrl, options = {}) {
  const listeners = new Map();
  const sent = [];
  const warnings = [];
  const answers = [];
  const users = [];
  const messages = [];
  const windowListeners = new Map();
  const units = [];
  const roleNodes = [];
  const location = {href: initialUrl};
  const state = {now: 1000, streaming: false};
  const form = {contains: () => true};
  const editor = {innerText: 'Prompt sintético', contains: () => true, closest: selector => selector === 'form' ? form : null};
  let tick;
  const document = {
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    querySelector(selector) {
      if (selector === '#prompt-textarea') return options.editorInFormOnly ? null : editor;
      if (selector === 'form [contenteditable="true"]') return options.editorInFormOnly ? editor : null;
      if (selector === 'button[data-testid="stop-button"]') return state.streaming ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-message-author-role="assistant"]' || selector === '[data-message-author-role="assistant"], [data-conversation-role="assistant"]') return answers;
      if (selector === '[data-message-author-role="user"]' || selector === '[data-message-author-role="user"], [data-conversation-role="user"]') return users;
      if (selector === '[data-message-author-role]') return messages;
      if (selector === '[data-content-search-unit-key]') return units;
      if (selector === '[data-message-author-role], [data-conversation-role]') return roleNodes;
      return [];
    }
  };
  const chrome = {
    runtime: {
      async sendMessage(message) {
        sent.push(message);
        if (message.type === 'status') {
          if (options.statusError) throw new Error(options.statusError);
          if (options.statusGate) await options.statusGate;
          return {ok: true, data: {enabled: true}};
        }
        if (message.type === 'network_capture_result' && options.failNetworkComparison) throw new Error('diagnóstico comparativo indisponível');
        if (message.type === 'response' && options.responseFailures > 0) {
          options.responseFailures--;
          throw new Error('Failed to fetch');
        }
        if (message.type === 'prompt') return {ok: true, data: {interaction_id: interactionId}};
        return {ok: true, data: {interaction_id: interactionId}};
      }
    }
  };
  const FakeDate = class extends Date { static now() { return state.now; } };
  vm.runInNewContext(source, {
    chrome, document, location, window: {addEventListener(type, callback) { windowListeners.set(type, callback); }},
    setInterval(callback) { tick = callback; }, setTimeout(callback, delay) { if (delay < 30000) callback(); return 1; },
    Date: FakeDate, URL, Set,
    crypto: {randomUUID: () => '00000000-0000-4000-8000-000000000001'},
    console: {warn(...parts) { warnings.push(parts.join(' ')); }}
  });
  async function flush() { await new Promise(resolve => setImmediate(resolve)); }
  async function clickSend() {
    const button = {matches: selector => selector === 'button[data-testid="send-button"]', type: 'button'};
    for (const callback of listeners.get('click')) {
      callback({target: {closest(selector) { return selector === 'button' ? button : null; }}});
    }
    await flush();
  }
  async function pressEnter() {
    for (const callback of listeners.get('keydown')) callback({key: 'Enter', shiftKey: false, isComposing: false, target: editor});
    await flush();
  }
  async function submitForm() {
    for (const callback of listeners.get('submit')) callback({target: form});
    await flush();
  }
  return {sent, warnings, answers, users, messages, units, roleNodes, location, state, windowListeners,
    emitNetworkCapture(detail) { windowListeners.get('governanca-ai-network-capture')?.({detail}); },
    tick: () => tick(), flush, clickSend, pressEnter, submitForm};
}

const message = (role, innerText) => ({innerText, getAttribute: name => name === 'data-message-author-role' ? role : null});
const searchUnit = (role, text, hasControls = false) => ({
  innerText: role === 'assistant' ? `ChatGPT disse:\n${text}\nCopiar` : text,
  getAttribute: () => null,
  hasAttribute: name => name === 'data-content-search-unit-key',
  closest: selector => selector === '[data-turn-key]' && hasControls
    ? {querySelector: child => child === '.turn-action-controls' ? {} : null} : null,
  querySelector: selector => selector === '[data-conversation-role]'
    ? {getAttribute: name => name === 'data-conversation-role' ? role : null} : null,
  querySelectorAll: selector => selector === '[data-markdown-text-style="assistant-message"]' && role === 'assistant'
    ? [{innerText: text}] : []
});

test('Enter captura o prompt quando o editor perdeu o seletor antigo', async () => {
  const page = setup('https://chatgpt.com/c/original', {editorInFormOnly: true});
  await page.pressEnter();
  assert.equal(page.sent.filter(item => item.type === 'prompt').length, 1);
});

test('submit do formulário captura o prompt quando o evento de tecla não chega', async () => {
  const page = setup('https://chatgpt.com/c/original', {editorInFormOnly: true});
  await page.submitForm();
  assert.equal(page.sent.filter(item => item.type === 'prompt').length, 1);
});

test('uma conversa nova pode mudar para /c/ sem encerrar a observação', async () => {
  const page = setup('https://chatgpt.com/');
  await page.clickSend();
  page.location.href = 'https://chatgpt.com/c/synthetic';
  page.tick();
  page.location.href = 'https://chatgpt.com/c/synthetic?model=auto';
  page.tick();
  assert.equal(page.sent.filter(item => item.type === 'response').length, 0);
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);

  page.answers.push({innerText: 'Resposta sintética'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.ok(response, JSON.stringify({sent: page.sent, warnings: page.warnings}));
  assert.equal(response.id, interactionId);
  assert.equal(response.payload.capture_status, 'complete');
  assert.equal(response.payload.text, 'Resposta sintética');
});

test('a resposta reconstruída do stream só é escolhida quando coincide com o DOM', async () => {
  const page = setup('https://chatgpt.com/c/network-capture');
  await page.clickSend();
  const answer = {innerText: 'Resposta sintética QA-NETWORK-CAPTURE'};
  page.answers.push(answer);
  page.state.streaming = true;
  page.tick();
  page.emitNetworkCapture({attemptId: '00000000-0000-4000-8000-000000000001',
    text: answer.innerText, protocolDone: true, requestId: 12});
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  const comparison = page.sent.find(item => item.type === 'network_capture_result');
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(comparison.matched, true);
  assert.equal(response.payload.text, answer.innerText);
  assert.equal(response.payload.adapter_version, '0.3.2-network');
});

test('candidato de rede divergente não substitui a resposta do DOM', async () => {
  const page = setup('https://chatgpt.com/c/network-mismatch');
  await page.clickSend();
  const answer = {innerText: 'Resposta visível sintética'};
  page.answers.push(answer);
  page.state.streaming = true;
  page.tick();
  page.emitNetworkCapture({attemptId: '00000000-0000-4000-8000-000000000001',
    text: 'Resposta de rede diferente', protocolDone: true, requestId: 13});
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  assert.equal(page.sent.find(item => item.type === 'network_capture_result').matched, false);
  assert.equal(page.sent.find(item => item.type === 'response').payload.text, answer.innerText);
});

test('falha no diagnóstico do espelho não impede POST da resposta', async () => {
  const page = setup('https://chatgpt.com/c/diagnostic-failure', {failNetworkComparison: true});
  await page.clickSend();
  page.answers.push({innerText: 'Resposta capturada pelo DOM'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta capturada pelo DOM');
});

test('DONE e igualdade DOM finalizam resposta curta mesmo sem poll observar o streaming', async () => {
  const page = setup('https://chatgpt.com/c/network-fast');
  await page.clickSend();
  const answer = {innerText: 'OK-REDE-031'};
  page.answers.push(answer);
  page.emitNetworkCapture({attemptId: '00000000-0000-4000-8000-000000000001',
    text: answer.innerText, protocolDone: true, requestId: 31});
  page.tick();
  page.state.now += 600;
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'OK-REDE-031');
  assert.equal(response.payload.capture_status, 'complete');
});

test('candidato de rede que chega antes da conclusão assíncrona do status é associado depois', async () => {
  let releaseStatus;
  const statusGate = new Promise(resolve => { releaseStatus = resolve; });
  const page = setup('https://chatgpt.com/c/network-race', {statusGate});
  await page.clickSend();
  page.emitNetworkCapture({attemptId: '00000000-0000-4000-8000-000000000001',
    text: 'OK-REDE-RACE', protocolDone: true, requestId: 32});
  releaseStatus();
  await page.flush();
  page.answers.push({innerText: 'OK-REDE-RACE'});
  page.tick();
  page.state.now += 600;
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'OK-REDE-RACE');
  assert.equal(response.payload.capture_status, 'complete');
});

test('reconhece papel de mensagem quando data-conversation-role está no próprio nó', async () => {
  const page = setup('https://chatgpt.com/c/self-role');
  await page.clickSend();
  const selfRole = (role, innerText) => ({innerText, getAttribute: name => name === 'data-conversation-role' ? role : null,
    hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => []});
  page.units.push(selfRole('user', 'Prompt sintético'), selfRole('assistant', 'OK-REDE-030'));
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'OK-REDE-030');
});

test('fallback descobre data-conversation-role quando não há search units', async () => {
  const page = setup('https://chatgpt.com/c/conversation-role-fallback');
  await page.clickSend();
  const selfRole = (role, innerText) => ({innerText, getAttribute: name => name === 'data-conversation-role' ? role : null,
    hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [], contains: () => false});
  page.roleNodes.push(selfRole('user', 'Prompt sintético'), selfRole('assistant', 'OK-ROLE-FALLBACK'));
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'OK-ROLE-FALLBACK');
});

test('faz retry transitório do POST da resposta com a mesma chave de idempotência', async () => {
  const page = setup('https://chatgpt.com/c/response-retry', {responseFailures: 1});
  await page.clickSend();
  page.answers.push({innerText: 'Resposta após retry'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  const attempts = page.sent.filter(item => item.type === 'response');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].payload.client_event_id, attempts[1].payload.client_event_id);
});

test('conversa nova em projeto mantém a observação ao abrir rota aninhada', async () => {
  const page = setup('https://chatgpt.com/');
  await page.clickSend();
  page.location.href = 'https://chatgpt.com/g/projeto/c/synthetic';
  page.tick();
  page.answers.push({innerText: 'Resposta no projeto'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'Resposta no projeto');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('mudar prefixo da rota preserva a mesma conversa', async () => {
  const page = setup('https://chatgpt.com/c/synthetic');
  await page.clickSend();
  page.location.href = 'https://chatgpt.com/g/projeto/c/synthetic';
  page.tick();
  page.answers.push({innerText: 'Resposta na mesma conversa'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'Resposta na mesma conversa');
});

test('rota sem /c/ só é adotada quando o prompt enviado está visível', async () => {
  const page = setup('https://chatgpt.com/');
  await page.clickSend();
  page.location.href = 'https://chatgpt.com/g/projeto';
  page.tick();
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
  page.users.push({innerText: 'Prompt sintético'});
  page.tick();
  page.answers.push({innerText: 'Resposta observada'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'Resposta observada');
});

test('mudança para outra conversa sem texto não envia resposta vazia', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.location.href = 'https://chatgpt.com/c/other';
  page.tick();
  await page.flush();

  assert.equal(page.sent.filter(item => item.type === 'response').length, 0);
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 1);
});

test('texto visível sem sinal de streaming é entregue como incompleto', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Resposta sintética observada'});
  page.tick();
  page.state.now += 11000;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.capture_status, 'incomplete');
  assert.equal(response.payload.text, 'Resposta sintética observada');
});

test('recriar mensagens antigas no DOM não é confundido com resposta nova', async () => {
  const page = setup('https://chatgpt.com/c/original');
  page.answers.push({innerText: 'Resposta antiga'});
  await page.clickSend();
  page.answers[0] = {innerText: 'Resposta antiga'};
  page.tick();
  assert.equal(page.sent.filter(item => item.type === 'response').length, 0);

  page.answers.push({innerText: 'Resposta nova'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta nova');
  assert.equal(response.payload.capture_status, 'complete');
});

test('captura resposta quando o histórico troca um bloco sem aumentar a contagem', async () => {
  const page = setup('https://chatgpt.com/c/original');
  page.answers.push({innerText: 'Resposta antiga 1'}, {innerText: 'Resposta antiga 2'});
  await page.clickSend();
  page.answers.shift();
  page.answers.push({innerText: 'Resposta nova'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta nova');
  assert.equal(response.payload.capture_status, 'complete');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('associa resposta ao último prompt mesmo com contagem e texto iguais aos anteriores', async () => {
  const page = setup('https://chatgpt.com/c/original');
  page.answers.push(message('assistant', 'OK'));
  await page.clickSend();
  page.answers[0] = message('assistant', 'OK');
  page.messages.push(message('user', 'Prompt sintético'), page.answers[0]);
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'OK');
  assert.equal(response.payload.capture_status, 'complete');
});

test('captura resposta da estrutura com data-content-search-unit-key mostrada no Chrome', async () => {
  const page = setup('https://chatgpt.com/c/original');
  page.units.push(searchUnit('assistant', 'Resposta antiga'));
  await page.clickSend();
  page.units.push(searchUnit('user', 'Prompt sintético'), searchUnit('assistant', 'Resposta nova'));
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta nova');
  assert.equal(response.payload.capture_status, 'complete');
});

test('estrutura nova associa respostas iguais quando o histórico substitui elementos', async () => {
  const page = setup('https://chatgpt.com/c/original');
  page.units.push(searchUnit('assistant', 'OK'));
  await page.clickSend();
  page.units.splice(0, 1, searchUnit('user', 'Prompt sintético'), searchUnit('assistant', 'OK'));
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'OK');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('estrutura nova entrega a última resposta ao exibir controles da resposta', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.units.push(searchUnit('user', 'Prompt sintético'), searchUnit('assistant', 'Resposta final', true));
  page.tick();
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta final');
  assert.equal(response.payload.capture_status, 'incomplete');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('revisa o DOM no envio seguinte antes de declarar falha de captura', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Resposta concluída entre duas leituras'});
  page.state.now += 1000;
  await page.clickSend();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta concluída entre duas leituras');
  assert.equal(response.payload.capture_status, 'incomplete');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('falha de resposta registra somente sinais estruturais para diagnóstico', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  const user = message('user', 'Prompt sintético');
  page.users.push(user);
  page.messages.push(user);
  page.state.now += 1000;
  await page.clickSend();

  const failure = page.sent.find(item => item.type === 'capture_failed');
  assert.equal(failure.reason, 'new_prompt');
  assert.equal(failure.diagnostics.assistant_count, 0);
  assert.equal(failure.diagnostics.user_count, 1);
  assert.equal(failure.diagnostics.answers_after_user, 0);
  assert.equal(failure.diagnostics.last_user_matches, true);
  assert.equal(JSON.stringify(failure.diagnostics).includes('Prompt sintético'), false);
});

test('preserva a completude quando o streaming terminou antes do envio seguinte', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.answers.push({innerText: 'Resposta final'});
  page.state.now += 1000;
  await page.clickSend();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta final');
  assert.equal(response.payload.capture_status, 'complete');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('múltiplos blocos novos são capturados sem declarar completude', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Primeiro bloco'}, {innerText: 'Resposta final'});
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();

  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta final');
  assert.equal(response.payload.capture_status, 'incomplete');
  assert.equal(page.sent.filter(item => item.type === 'capture_failed').length, 0);
});

test('aba antiga informa quando a extensão perdeu o contexto após recarga', async () => {
  const page = setup('https://chatgpt.com/c/original', {statusError: 'Extension context invalidated.'});
  await page.clickSend();

  assert.equal(page.sent.filter(item => item.type === 'prompt').length, 0);
  assert.match(page.warnings.join(' '), /Recarregue a aba do ChatGPT/);
});
