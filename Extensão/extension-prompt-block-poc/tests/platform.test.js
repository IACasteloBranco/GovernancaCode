import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/platform.js', import.meta.url), 'utf8');
const textNode = value => ({nodeType: 3, nodeValue: value});
function domElement(tagName, attributes = {}, children = []) {
  const node = {
    nodeType: 1, tagName: tagName.toUpperCase(), attributes, childNodes: children, parentElement: null,
    get className() { return attributes.class || ''; },
    get textContent() { return this.childNodes.map(child => child.nodeType === 3 ? child.nodeValue : child.textContent).join(''); },
    get innerText() { return this.textContent; },
    getAttribute(name) { return attributes[name] ?? null; },
    matches(selector) {
      return selector.split(',').some(raw => {
        const part = raw.trim();
        const tag = part.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && tag.toLowerCase() !== this.tagName.toLowerCase()) return false;
        for (const [, cls] of part.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(cls)) return false;
        for (const [, name, operator, value] of part.matchAll(/\[([\w-]+)(?:(\*=|~=|=)"([^"]*)"(?:\s+i)?)?\]/gi)) {
          const actual = this.getAttribute(name);
          if (actual == null) return false;
          if (operator === '=' && actual !== value) return false;
          if (operator === '*=' && !actual.toLowerCase().includes(value.toLowerCase())) return false;
          if (operator === '~=' && !actual.split(/\s+/).includes(value)) return false;
        }
        return true;
      });
    },
    querySelectorAll(selector) {
      const result = [];
      const visit = parent => parent.childNodes.forEach(child => {
        if (child.nodeType !== 1) return;
        if (child.matches(selector)) result.push(child);
        visit(child);
      });
      visit(this);
      return result;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    cloneNode() { return domElement(this.tagName, {...attributes}, this.childNodes.map(child =>
      child.nodeType === 3 ? textNode(child.nodeValue) : child.cloneNode(true))); },
    remove() { if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter(child => child !== this); }
  };
  for (const child of children) if (child.nodeType === 1) child.parentElement = node;
  return node;
}
function setup(fields, buttons = [], statuses = []) {
  const context = {URL, location: {href: 'https://claude.ai/new'}, document: {
    querySelectorAll: selector => selector === '[contenteditable="true"], textarea' ? fields : selector === 'button' ? buttons :
      selector === '[role="status"], [aria-live]' ? statuses : []
  }};
  vm.runInNewContext(source, context);
  return context.GovernancaPlatform;
}
const field = options => ({getClientRects: () => [1], closest: () => null, ...options});

test('Claude reconhece editor único sem classe ProseMirror', () => {
  const editable = field();
  assert.equal(setup([editable]).editor(), editable);
});
test('Claude não escolhe campo ambíguo nem editor de artefato', () => {
  assert.equal(setup([field(), field()]).editor(), null);
  assert.equal(setup([field({closest: () => ({})})]).editor(), null);
  assert.equal(setup([field({getClientRects: () => []})]).editor(), null);
});
test('Claude reconhece Send Message sem distinguir maiúsculas', () => {
  const button = {getAttribute: () => ' Send Message ', getClientRects: () => [1]};
  assert.equal(setup([], [button]).sendButton(button), true);
});
test('Stop Response não é confundido com botão de envio', () => {
  const button = {type: 'submit', getAttribute: () => 'Stop Response', getClientRects: () => [1]};
  const adapter = setup([], [button]);
  assert.equal(adapter.streaming(), true);
  assert.equal(adapter.sendButton(button), false);
});

test('Claude treats a disabled send button as a ready composer after a response', () => {
  const button = {getAttribute: () => 'Send Message', getClientRects: () => [1], disabled: true};
  assert.equal(setup([], [button]).ready(), true);
});

test('Claude completion signal requires a recognized status message', () => {
  const status = {innerText: 'Claude terminou a resposta'};
  assert.equal(setup([], [], [status]).completionSignal(), true);
  assert.equal(setup([], [], [{innerText: 'Gerando resposta'}]).completionSignal(), false);
});

test('Claude response extraction omits accessibility and action chrome while preserving Markdown', () => {
  const adapter = setup([]);
  const controlNodes = [
    {tagName: 'SPAN', match: '[aria-label]'}, {tagName: 'SPAN', match: '[aria-hidden="true"]'},
    {tagName: 'BUTTON', match: 'button'}, {tagName: 'TIME', match: 'time'}
  ].map(({tagName, match}) => ({nodeType: 1, tagName, childNodes: [], matches: selector => selector.split(',').some(item => item.trim() === match)}));
  const content = {
    nodeType: 1, tagName: 'DIV',
    childNodes: [{nodeType: 3, nodeValue: 'Primeiro parágrafo\n\n**Segundo parágrafo**'}, ...controlNodes],
    matches: () => false,
    cloneNode() { return this; },
    querySelectorAll(selector) {
      if (selector === 'button') return [controlNodes[2]];
      if (selector === '[aria-hidden="true"]') return [controlNodes[1]];
      if (selector === '[aria-label]') return [controlNodes[0]];
      if (selector === 'time') return [controlNodes[3]];
      return [];
    }
  };
  const message = {
    matches: () => false,
    querySelector: selector => selector === '.font-claude-response' ? content : null,
    innerText: 'Claude respondeu: Primeiro parágrafo **Segundo parágrafo** ★ ◉ Copiar resposta agora'
  };
  assert.equal(adapter.responseText(message), 'Primeiro parágrafo\n\n**Segundo parágrafo**');
});

test('Claude serializes semantic Markdown and excludes content outside the response body', () => {
  const adapter = setup([]);
  const markdown = domElement('div', {class: 'standard-markdown'}, [
    domElement('h2', {}, [textNode('QA-MD-START')]),
    domElement('p', {}, [textNode('Introdução sintética.')]),
    domElement('ul', {}, [domElement('li', {}, [textNode('QA-MD-CELL')])]),
    domElement('table', {}, [
      domElement('tr', {}, [domElement('th', {}, [textNode('Campo')]), domElement('th', {}, [textNode('Valor')])]),
      domElement('tr', {}, [domElement('td', {}, [textNode('Tipo')]), domElement('td', {}, [textNode('QA-MD-CELL')])])
    ]),
    domElement('pre', {}, [domElement('code', {class: 'language-html'}, [textNode('<div>QA-MD-CODE</div>')])])
  ]);
  const answer = domElement('div', {class: 'font-claude-response'}, [
    markdown, domElement('aside', {}, [textNode('O Claude trabalha diretamente com sua base de código.')])
  ]);
  const text = adapter.responseText(answer);
  assert.match(text, /# QA-MD-START/);
  assert.match(text, /- QA-MD-CELL/);
  assert.match(text, /\| Tipo \| QA-MD-CELL \|/);
  assert.match(text, /```html\n<div>QA-MD-CODE<\/div>\n```/);
  assert.equal(text.includes('O Claude trabalha'), false);
});

test('Claude captures a semantic pre/code block rendered beside the Markdown root', () => {
  const adapter = setup([]);
  const markdown = domElement('div', {class: 'standard-markdown'}, [
    domElement('p', {}, [textNode('Texto principal.')])
  ]);
  const codeBlock = domElement('pre', {}, [
    domElement('code', {class: 'language-js'}, [textNode('const marker = "QA-MD-CODE-0612";')])
  ]);
  const response = domElement('div', {class: 'font-claude-response'}, [
    markdown, codeBlock, domElement('aside', {}, [textNode('Conteúdo externo à resposta.')])
  ]);
  const text = adapter.responseText(response);
  assert.match(text, /Texto principal\./);
  assert.match(text, /```js\nconst marker = "QA-MD-CODE-0612";\n```/);
  assert.equal(text.includes('Conteúdo externo'), false);
});
