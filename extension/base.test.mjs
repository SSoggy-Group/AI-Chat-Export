import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatParser } from './content/parsers/base.js';
import { ExportFormatter } from './content/formatters/base.js';

test('ChatParser base class throws Not implemented', async () => {
  const parser = new ChatParser();
  assert.throws(() => parser.isAvailable('https://example.com'), {
    name: 'Error',
    message: 'Not implemented',
  });
  await assert.rejects(async () => await parser.parse(), {
    name: 'Error',
    message: 'Not implemented',
  });
});

test('ExportFormatter base class throws Not implemented', () => {
  const formatter = new ExportFormatter();
  assert.throws(() => formatter.format({ title: 'test', messages: [] }), {
    name: 'Error',
    message: 'Not implemented',
  });
  assert.throws(() => formatter.getFileExtension(), {
    name: 'Error',
    message: 'Not implemented',
  });
  assert.throws(() => formatter.getMimeType(), {
    name: 'Error',
    message: 'Not implemented',
  });
});
