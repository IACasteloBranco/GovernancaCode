import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content/files.js', import.meta.url), 'utf8');

function createFiles() {
  const context = {Number};
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.GovernancaFiles;
}

const serialize = value => JSON.parse(JSON.stringify(value));

test('observes only file metadata inside the submitted composer', () => {
  let bytesRead = false;
  const file = {name: 'relatorio-sintetico.pdf', type: 'application/pdf', size: 1234,
    arrayBuffer() { bytesRead = true; throw new Error('file bytes must not be read'); }};
  const root = {querySelectorAll: selector => selector === 'input[type="file"]' ? [{files: [file]}] : []};

  const observation = serialize(createFiles().observe(root));

  assert.deepEqual(observation, {capture_status: 'observed', truncated: false, items: [{
    name: 'relatorio-sintetico.pdf', mime_type: 'application/pdf', size_bytes: 1234,
    capture_status: 'metadata_only', source: 'selection_event'
  }]});
  assert.equal(bytesRead, false);
});

test('preserves duplicate filenames and unknown MIME without guessing', () => {
  const files = createFiles();
  const root = {querySelectorAll: () => [{files: [
    {name: 'anexo.txt', type: '', size: 12}, {name: 'anexo.txt', type: '', size: 13}
  ]}]};

  const observation = serialize(files.observe(root));

  assert.equal(observation.items.length, 2);
  assert.equal(observation.items[0].mime_type, null);
  assert.equal(observation.items[0].size_bytes, 12);
  assert.equal(observation.items[1].size_bytes, 13);
});

test('captures a visible composer card after ChatGPT clears the file input', () => {
  const files = createFiles();
  const root = {querySelectorAll: selector => selector === '[data-composer-attachments] button[aria-label]'
    ? [{getAttribute: name => name === 'aria-label' ? 'synthetic-document.txt' : null},
      {getAttribute: name => name === 'aria-label' ? 'Remover synthetic-document.txt' : null}]
    : []};

  const observation = serialize(files.observe(root));

  assert.deepEqual(observation, {capture_status: 'observed', truncated: false, items: [{
    name: 'synthetic-document.txt', mime_type: null, size_bytes: null,
    capture_status: 'metadata_only', source: 'visible_card'
  }]});
});

test('merges file input and visible card evidence without duplicating matching files', () => {
  const files = createFiles();
  const root = {querySelectorAll: selector => selector === 'input[type="file"]'
    ? [{files: [{name: 'known.txt', type: 'text/plain', size: 4}]}]
    : [{getAttribute: () => 'known.txt'}, {getAttribute: () => 'card-only.pdf'}]};

  const observation = serialize(files.observe(root));

  assert.equal(observation.items.length, 2);
  assert.equal(observation.items[0].source, 'selection_event');
  assert.deepEqual(observation.items[1], {name: 'card-only.pdf', mime_type: null, size_bytes: null,
    capture_status: 'metadata_only', source: 'visible_card'});
});

test('distinguishes empty and unavailable composer observations and reports truncation', () => {
  const files = createFiles();
  const empty = serialize(files.observe({querySelectorAll: () => [{files: []}]}));
  const missing = serialize(files.observe({querySelectorAll: () => []}));
  const many = serialize(files.observe({querySelectorAll: () => [{files: Array.from({length: 21}, (_, i) => ({
    name: `file-${i}.txt`, type: 'text/plain', size: i
  }))}]}));

  assert.deepEqual(empty, {capture_status: 'not_observed', items: [], truncated: false});
  assert.deepEqual(missing, {capture_status: 'unavailable', items: [], truncated: false});
  assert.equal(many.items.length, 20);
  assert.equal(many.truncated, true);
});
