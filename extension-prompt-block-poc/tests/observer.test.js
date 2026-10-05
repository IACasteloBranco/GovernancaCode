import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/observer.js', import.meta.url), 'utf8');
const interactionId = '5e9585f9-61fe-4e15-ba85-93f3451ae7d7';

function setup(initialUrl, options = {}) {
  const listeners = new Map();
  const sent = [];
  let responseFailures = 0;
  const warnings = [];
  const answers = [];
  const users = [];
  const messages = [];
  const units = [];
  const location = {href: initialUrl};
  const state = {now: 1000, streaming: false, composer: null};
  const form = {
    contains: () => true,
    querySelectorAll: selector => selector === 'button' && state.composer
      ? [{getAttribute: name => name === 'aria-label' ? state.composer : null,
          getClientRects: () => [1]}] : []
  };
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
      if (selector === '[data-message-author-role="assistant"]') return answers;
      if (selector === '[data-message-author-role="user"]') return users;
      if (selector === '[data-message-author-role]') return messages;
      if (selector === '[data-content-search-unit-key]') return units;
      return [];
    }
  };
  const chrome = {
    runtime: {
      async sendMessage(message) {
        sent.push(message);
        if (message.type === 'status') {
          if (options.statusError) throw new Error(options.statusError);
          return {ok: true, data: {enabled: true}};
        }
        if (message.type === 'prompt') return {ok: true, data: {interaction_id: interactionId}};
        if (message.type === 'response' && options.failResponseOnce && responseFailures++ === 0)
          throw new Error('Could not establish connection. Receiving end does not exist.');
        return {ok: true, data: {interaction_id: interactionId}};
      }
    }
  };
  const FakeDate = class extends Date { static now() { return state.now; } };
  vm.runInNewContext(source, {
    GovernancaFiles: options.files ? {observe: root => root?.observation ||
      {capture_status: root ? 'not_observed' : 'unavailable', items: [], truncated: false}} : undefined,
    GovernancaPlatform: options.claude ? {
      claude: true, editor: () => editor, composer: () => form, messages: () => messages,
      role: node => node?.getAttribute?.('data-message-author-role'),
      sendButton: node => node?.getAttribute?.('aria-label') === 'Enviar', stopButton: () => false,
      streaming: () => state.streaming, ready: () => !state.streaming
    } : undefined,
    chrome, document, location, window: {addEventListener() {}},
    setInterval(callback) { tick = callback; },
    Date: FakeDate, URL, Set,
    setTimeout: callback => callback(),
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
  async function clickLabeledSend() {
    const button = {matches: () => false, type: 'button', getAttribute: name => name === 'aria-label' ? 'Enviar' : null};
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
  return {sent, warnings, answers, users, messages, units, location, state, editor, form, tick: () => tick(), flush, clickSend, clickLabeledSend, pressEnter, submitForm};
}

test('Claude adota /chat/ e associa a resposta ao prompt enviado', async () => {
  const page = setup('https://claude.ai/new', {claude: true, files: true});
  await page.clickLabeledSend();
  page.location.href = 'https://claude.ai/chat/synthetic';
  page.messages.push(message('user', 'Prompt sintético'), message('assistant', 'Resposta Claude'));
  page.state.streaming = true;
  page.tick();
  page.state.streaming = false;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  assert.equal(page.sent.find(item => item.type === 'response').payload.text, 'Resposta Claude');
});

test('falha transitória na entrega da resposta reenvia o mesmo evento', async () => {
  const page = setup('https://claude.ai/chat/synthetic', {failResponseOnce: true});
  await page.clickSend();
  page.answers.push({innerText: 'Resposta sintética'});
  page.tick();
  page.state.now += 11000;
  page.tick();
  await page.flush();
  const attempts = page.sent.filter(item => item.type === 'response');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].payload.client_event_id, attempts[1].payload.client_event_id);
  assert.equal(attempts[0].payload.text, attempts[1].payload.text);
});

test('arquivo sem prompt e material sem texto mantêm os vínculos e metadados', async () => {
  const page = setup('https://chatgpt.com/c/synthetic', {files: true});
  page.editor.innerText = '';
  page.form.observation = {capture_status: 'observed', items: [{name: 'input.csv', capture_status: 'metadata_only'}], truncated: false};
  await page.clickSend();
  const prompt = page.sent.find(item => item.type === 'prompt').payload;
  assert.equal(prompt.text, undefined);
  assert.equal(prompt.prompt.text, '');
  assert.equal(prompt.attachments[0].name, 'input.csv');
  const material = {innerText: '', observation: {capture_status: 'observed', items: [{capture_status: 'presence_only'}], truncated: false}};
  page.answers.push(material);
  page.tick();
  page.state.now += 11000;
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.id, interactionId);
  assert.equal(response.payload.text, '');
  assert.equal(response.payload.generated_materials.items[0].capture_status, 'presence_only');
  assert.equal(page.sent.some(item => item.type === 'capture_failed'), false);
});

test('material antigo não é atribuído ao prompt seguinte', async () => {
  const page = setup('https://chatgpt.com/c/synthetic', {files: true});
  page.answers.push({innerText: '', observation: {capture_status: 'observed', items: [{capture_status: 'presence_only'}], truncated: false}});
  await page.clickSend();
  page.answers.push({innerText: 'Criei um arquivo'});
  page.tick();
  page.state.now += 11000;
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response').payload;
  assert.equal(response.generated_materials.capture_status, 'not_observed');
});

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

test('botão Enviar sem data-testid captura o prompt', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickLabeledSend();
  assert.equal(page.sent.filter(item => item.type === 'prompt').length, 1);
});

test('botão Parar volta ao estado normal antes de concluir a resposta', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickLabeledSend();
  page.answers.push({innerText: 'Resposta final'});
  page.state.composer = 'Parar';
  page.tick();
  page.state.composer = null;
  page.state.now += 2500;
  page.tick();
  await page.flush();
  assert.equal(page.sent.filter(item => item.type === 'response').length, 0);
  page.state.composer = 'Iniciar conversa por voz';
  page.tick();
  await page.flush();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta final');
  assert.equal(response.payload.capture_status, 'complete');
});

test('captura o ID estável do projeto na URL do prompt', async () => {
  const page = setup('https://chatgpt.com/g/g-p-6abacc4edb1c81918be5e01d0038640a/project');
  await page.clickSend();
  const project = page.sent.find(item => item.type === 'prompt').payload.project;
  assert.equal(project.capture_status, 'observed');
  assert.equal(project.url, 'https://chatgpt.com/g/g-p-6abacc4edb1c81918be5e01d0038640a/project');
});

test('remove o nome do projeto da URL ao capturar o ID estável', async () => {
  const page = setup('https://chatgpt.com/g/g-p-6abe9293e8248191ada3632b6a5316a6-eduardo/c/conversa');
  await page.clickSend();
  const project = page.sent.find(item => item.type === 'prompt').payload.project;
  assert.equal(project.capture_status, 'observed');
  assert.equal(project.url, 'https://chatgpt.com/g/g-p-6abe9293e8248191ada3632b6a5316a6/project');
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
  assert.equal(response.id, interactionId);
  assert.equal(response.payload.capture_status, 'complete');
  assert.equal(response.payload.text, 'Resposta sintética');
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

test('novo prompt conclui resposta curta quando o compositor voltou ao estado normal', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Resposta curta final'});
  page.state.composer = 'Iniciar conversa por voz';
  page.state.now += 1000;
  await page.clickSend();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta curta final');
  assert.equal(response.payload.capture_status, 'complete');
});

test('novo prompt preserva botão normal observado antes da consulta assíncrona', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Resposta curta final'});
  page.state.composer = 'Enviar';
  page.state.now += 1000;
  const pending = page.pressEnter();
  page.state.composer = 'Parar';
  await pending;
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta curta final');
  assert.equal(response.payload.capture_status, 'complete');
});

test('bloco de assistente vazio não torna ambígua a resposta final', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.units.push(searchUnit('user', 'Prompt sintético'), searchUnit('assistant', ''),
    searchUnit('assistant', 'Resposta final'));
  page.state.composer = 'Enviar';
  page.state.now += 1000;
  await page.pressEnter();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.text, 'Resposta final');
  assert.equal(response.payload.capture_status, 'complete');
});

test('novo prompt não conclui resposta enquanto o botão Parar está visível', async () => {
  const page = setup('https://chatgpt.com/c/original');
  await page.clickSend();
  page.answers.push({innerText: 'Resposta parcial'});
  page.state.composer = 'Parar';
  page.state.now += 1000;
  await page.clickSend();
  const response = page.sent.find(item => item.type === 'response');
  assert.equal(response.payload.capture_status, 'incomplete');
  assert.equal(response.reason, 'new_prompt');
  assert.equal(response.evidence.stop, true);
  assert.equal(response.evidence.answer_chars, 'Resposta parcial'.length);
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
