import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from '../app/node_modules/happy-dom/lib/index.js';
import { QwenParser } from './content/parsers/qwen.js';

function setupDOM() {
  const win = new Window();
  global.window = win;
  global.document = win.document;
  global.HTMLElement = win.HTMLElement;
  global.Node = win.Node;
  return win;
}

function buildChatDOM(msgCount = 100, attachCount = 5) {
  document.body.innerHTML = '<div id="chat-root"></div>';
  const container = document.getElementById('chat-root');

  const titleEl = document.createElement('h1');
  titleEl.textContent = 'Qwen Test Conversation';
  container.appendChild(titleEl);

  for (let i = 0; i < msgCount; i++) {
    const isUser = i % 2 === 0;
    const msg = document.createElement('div');
    msg.className = isUser ? 'qwen-chat-message qwen-chat-message-user' : 'qwen-chat-message';

    if (isUser) {
      if (i < attachCount * 2) {
        const docItem = document.createElement('div');
        docItem.className = 'index-module__file-message-document___OjWnc';

        const name = document.createElement('span');
        name.className = 'fileitem-file-name-text';
        name.textContent = `document_${i}`;

        const ext = document.createElement('span');
        ext.className = 'fileitem-file-name-ext';
        ext.textContent = '.pdf';

        const size = document.createElement('div');
        size.className = 'fileitem-file-size';
        const sizeSpan = document.createElement('span');
        sizeSpan.textContent = '2.5 MB';
        size.appendChild(sizeSpan);

        docItem.appendChild(name);
        docItem.appendChild(ext);
        docItem.appendChild(size);
        msg.appendChild(docItem);
      }

      const content = document.createElement('div');
      content.className = 'user-message-content';
      content.textContent = `User question ${i}`;
      msg.appendChild(content);
    } else {
      const markdown = document.createElement('div');
      markdown.className = 'qwen-markdown';
      markdown.textContent = `Qwen answer ${i}`;
      msg.appendChild(markdown);
    }

    container.appendChild(msg);
  }
}

test('QwenParser isAvailable checks URL correctly', () => {
  const parser = new QwenParser();
  assert.equal(parser.isAvailable('https://chat.qwen.ai/'), true);
  assert.equal(parser.isAvailable('https://chat.qwenlm.ai/'), true);
  assert.equal(parser.isAvailable('https://qwen.ai/chat'), true);
  assert.equal(parser.isAvailable('https://chatgpt.com/'), false);
});

test('QwenParser parse extracts messages and attachments correctly', async () => {
  setupDOM();
  buildChatDOM(4, 1);

  const parser = new QwenParser();
  const result = await parser.parse();

  assert.equal(result.title, 'Qwen Test Conversation');
  assert.equal(result.messages.length, 4);

  assert.equal(result.messages[0].role, 'User');
  assert.equal(result.messages[0].content.includes('User question 0'), true);
  assert.equal(result.messages[0].content.includes('**document_0.pdf** (2.5 MB)'), true);

  assert.equal(result.messages[1].role, 'Qwen');
  assert.equal(result.messages[1].content, 'Qwen answer 1');

  assert.equal(result.messages[2].role, 'User');
  assert.equal(result.messages[2].content, 'User question 2');

  assert.equal(result.messages[3].role, 'Qwen');
  assert.equal(result.messages[3].content, 'Qwen answer 3');
});

test('QwenParser parse performance benchmark (0 attachments)', async () => {
  setupDOM();
  buildChatDOM(100, 0);

  const parser = new QwenParser();
  const iterations = 30;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await parser.parse();
  }
  const duration = performance.now() - start;

  console.log(`[Benchmark 0 attachments] QwenParser.parse ${iterations} iterations took ${duration.toFixed(2)} ms`);
});

test('QwenParser parse performance benchmark (with attachments)', async () => {
  setupDOM();
  buildChatDOM(100, 5);

  const parser = new QwenParser();
  const iterations = 30;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await parser.parse();
  }
  const duration = performance.now() - start;

  console.log(`[Benchmark 5 attachments] QwenParser.parse ${iterations} iterations took ${duration.toFixed(2)} ms`);
});
