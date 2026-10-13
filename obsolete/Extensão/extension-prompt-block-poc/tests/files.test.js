import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/files.js', import.meta.url), 'utf8');

function element(tagName, attributes = {}, children = []) {
  const node = {
    tagName: tagName.toUpperCase(), attributes, children, parentElement: null,
    getAttribute(name) { return attributes[name] ?? null; },
    hasAttribute(name) { return Object.hasOwn(attributes, name); },
    getClientRects() { return [1]; },
    matches(selector) {
      return selector.split(',').some(raw => {
        const part = raw.trim();
        const tag = part.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && tag.toLowerCase() !== this.tagName.toLowerCase()) return false;
        const className = part.match(/\.([\w-]+)/)?.[1];
        if (className && !(attributes.class || '').split(/\s+/).includes(className)) return false;
        for (const [, name, operator, value] of part.matchAll(/\[([\w-]+)(?:(\^=|=)"([^"]*)"(?:\s+i)?)?\]/gi)) {
          const actual = this.getAttribute(name);
          if (actual == null) return false;
          if (operator === '=' && actual !== value) return false;
          if (operator === '^=' && !actual.toLowerCase().startsWith(value.toLowerCase())) return false;
        }
        return true;
      });
    },
    contains(target) { return this === target || this.children.some(child => child.contains?.(target)); },
    closest(selector) {
      for (let current = this; current; current = current.parentElement)
        if (current.matches?.(selector)) return current;
      return null;
    },
    querySelectorAll(selector) {
      const result = [];
      const visit = parent => parent.children.forEach(child => {
        if (child.matches?.(selector)) result.push(child);
        visit(child);
      });
      visit(this);
      return result;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    get textContent() { return this.children.map(child => child.textContent || '').join(''); }
  };
  for (const child of children) child.parentElement = node;
  return node;
}

function loadFiles() {
  const context = {URL, location: {href: 'https://claude.ai/chat/synthetic'}, document: {addEventListener() {}}};
  vm.runInNewContext(source, context);
  return context.GovernancaFiles;
}

test('Visualize Widget records host presence and optional accessible label without reading iframe content', () => {
  const files = loadFiles();
  const iframe = element('iframe', {title: 'Visualize Widget', src: 'https://widget.example.invalid/synthetic-artifact'});
  Object.defineProperty(iframe, 'contentDocument', {get() { throw new Error('remote iframe must not be read'); }});
  const host = element('div', {'aria-label': 'visualize: SYNTHETIC_ARTIFACT_TITLE'}, [
    element('div', {class: 'vis-container'}, [iframe])
  ]);
  const message = element('div', {'data-testid': 'assistant-message'}, [host]);
  const result = files.observe(message, true);
  assert.equal(result.capture_status, 'observed');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'SYNTHETIC_ARTIFACT_TITLE');
  assert.equal(result.items[0].capture_status, 'presence_only');
  assert.equal(result.items[0].source, 'visible_card');
  assert.equal(JSON.stringify(result).includes('example.invalid'), false);
});

test('Visualize Widget beside response is associated through its single-response turn only', () => {
  const files = loadFiles();
  const response = element('div', {class: 'font-claude-response'}, [element('p', {}, [])]);
  const iframe = element('iframe', {title: 'Visualize Widget'});
  const host = element('div', {'aria-label': 'visualize: QA_ARTIFACT_SIBLING'}, [
    element('div', {class: 'vis-container'}, [iframe])
  ]);
  const turn = element('div', {}, [response, host]);
  const result = files.observe(response, true);
  assert.equal(result.capture_status, 'observed');
  assert.equal(result.items[0].name, 'QA_ARTIFACT_SIBLING');
  assert.equal(result.items[0].capture_status, 'presence_only');
  assert.equal(files.observe(turn, true).capture_status, 'observed');
});

test('Artifact text without a Visualize Widget is not material evidence', () => {
  const message = element('div', {'data-testid': 'assistant-message'}, [element('p', {}, [])]);
  Object.defineProperty(message.children[0], 'textContent', {value: 'A palavra Artifact aparece em uma frase.'});
  assert.equal(loadFiles().observe(message, true).capture_status, 'not_observed');
});

test('Artifact from an old message is absent when only the current message is observed', () => {
  const oldFrame = element('iframe', {title: 'Visualize Widget'});
  const oldMessage = element('div', {'data-testid': 'assistant-message'}, [
    element('div', {'aria-label': 'visualize: OLD_ARTIFACT'}, [element('div', {class: 'vis-container'}, [oldFrame])])
  ]);
  const currentMessage = element('div', {'data-testid': 'assistant-message'}, [element('p', {}, [])]);
  assert.equal(loadFiles().observe(currentMessage, true).capture_status, 'not_observed');
  assert.equal(loadFiles().observe(oldMessage, true).capture_status, 'observed');
});

test('Artifact sibling is not associated across a turn containing multiple responses', () => {
  const oldResponse = element('div', {class: 'font-claude-response'}, []);
  const currentResponse = element('div', {class: 'font-claude-response'}, []);
  const oldWidget = element('iframe', {title: 'Visualize Widget'});
  const staleHost = element('div', {'aria-label': 'visualize: STALE'}, [oldWidget]);
  element('div', {}, [oldResponse, staleHost, currentResponse]);
  assert.equal(loadFiles().observe(currentResponse, true).capture_status, 'not_observed');
});
