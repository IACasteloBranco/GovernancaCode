import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/platform.js', import.meta.url), 'utf8');
function setup(fields, buttons = []) {
  const context = {URL, location: {href: 'https://claude.ai/new'}, document: {
    querySelectorAll: selector => selector === '[contenteditable="true"], textarea' ? fields : selector === 'button' ? buttons : []
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
