import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatGPTParser } from './content/parsers/chatgpt.js';

class MockElement {
  constructor(tagName = 'div', attributes = {}, textContent = '') {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this._textContent = textContent;
    this._innerText = textContent;
    this.children = [];
    this.parentNode = null;
    this.nodeType = tagName.startsWith('#') ? 3 : 1;
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
    }
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = val;
  }

  get innerText() {
    if (this.children.length > 0) {
      return this.children.map(c => c.innerText).join('\n');
    }
    return this._innerText;
  }

  set innerText(val) {
    this._innerText = val;
  }

  get innerHTML() {
    if (this.children.length > 0) {
      return this.children.map(c => c.outerHTML).join('');
    }
    return this._textContent;
  }

  get outerHTML() {
    if (this.tagName === '#TEXT') return this._textContent;
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    const attrString = attrs ? ` ${attrs}` : '';
    return `<${this.tagName.toLowerCase()}${attrString}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  get classList() {
    const classes = (this.attributes.class || '').split(' ').filter(Boolean);
    return {
      contains: (c) => classes.includes(c),
    };
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx !== -1) {
      newChild.parentNode = this;
      this.children[idx] = newChild;
    }
  }

  matches(selector) {
    return matchSelector(this, selector);
  }

  querySelector(selector) {
    return findFirst(this, selector);
  }

  querySelectorAll(selector) {
    return findAll(this, selector);
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName, { ...this.attributes }, this._textContent);
    clone._innerText = this._innerText;
    if (deep) {
      this.children.forEach(child => {
        clone.appendChild(child.cloneNode(true));
      });
    }
    return clone;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1);
      }
      this.parentNode = null;
    }
  }
}

global.HTMLElement = MockElement;
global.Element = MockElement;
global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

const mockDocument = {
  title: 'ChatGPT Session',
  createElement: (tag) => new MockElement(tag),
  createTextNode: (text) => new MockElement('#text', {}, text),
  querySelector: () => null,
  querySelectorAll: () => [],
};
global.document = mockDocument;

function matchSelector(el, selector) {
  const parts = selector.split(',').map(s => s.trim());
  for (const part of parts) {
    if (matchSingleSelector(el, part)) return true;
  }
  return false;
}

function matchSingleSelector(el, selector) {
  if (selector === 'article') return el.tagName === 'ARTICLE';
  if (selector === 'button') return el.tagName === 'BUTTON';
  if (selector === 'img') return el.tagName === 'IMG';
  if (selector === 'main') return el.tagName === 'MAIN';
  if (selector === '[data-message-author-role]') return el.hasAttribute('data-message-author-role');
  if (selector === '[data-message-id]') return el.hasAttribute('data-message-id');
  if (selector === '[data-conversation]') return el.hasAttribute('data-conversation');
  if (selector === '[data-messages]') return el.hasAttribute('data-messages');
  if (selector === 'pre[data-conversation]') return el.tagName === 'PRE' && el.hasAttribute('data-conversation');
  if (selector === '[role="main"]') return el.getAttribute('role') === 'main';
  if (selector === '[role="button"]') return el.getAttribute('role') === 'button';
  if (selector === '[data-testid="model-selector-dropdown"]') return el.getAttribute('data-testid') === 'model-selector-dropdown';

  if (selector === '[data-item-index]') return el.hasAttribute('data-item-index');
  if (selector === '[data-index]') return el.hasAttribute('data-index');
  if (selector === '[data-virtual-list-item-key]') return el.hasAttribute('data-virtual-list-item-key');

  if (selector === '.markdown') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('markdown');
  if (selector === '.prose') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('prose');
  if (selector === '.whitespace-pre-wrap') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('whitespace-pre-wrap');
  if (selector === '.sr-only') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('sr-only');
  if (selector === '.conversation-data') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('conversation-data');
  if (selector === '.chat-transcript') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('chat-transcript');
  if (selector === '.conversation') return el.hasAttribute('class') && el.getAttribute('class').split(' ').includes('conversation');

  if (selector.startsWith('.flex.gap-2')) {
    const classes = el.getAttribute('class')?.split(' ') || [];
    return classes.includes('flex') && classes.includes('gap-2');
  }

  if (selector.startsWith('section[data-testid^="conversation-turn-"]')) {
    if (el.tagName !== 'SECTION') return false;
    const testid = el.getAttribute('data-testid') || '';
    return testid.startsWith('conversation-turn-');
  }

  if (selector.startsWith('iframe[src*="oaiusercontent.com"]')) {
    if (el.tagName !== 'IFRAME') return false;
    const src = el.getAttribute('src') || '';
    return src.includes('oaiusercontent.com');
  }

  return false;
}

function findFirst(root, selector) {
  if (root.matches && root.matches(selector)) return root;
  for (const child of root.children) {
    const found = findFirst(child, selector);
    if (found) return found;
  }
  return null;
}

function findAll(root, selector) {
  const results = [];
  function search(node) {
    if (node.matches && node.matches(selector)) {
      results.push(node);
    }
    for (const child of node.children) {
      search(child);
    }
  }
  if (root.children) {
    for (const child of root.children) {
      search(child);
    }
  }
  return results;
}

function createConfiguredParser() {
  const parser = new ChatGPTParser();
  parser.convertContentElement = (el) => el.textContent.trim();
  return parser;
}

test('ChatGPTParser.isAvailable', () => {
  const parser = new ChatGPTParser();
  assert.equal(parser.isAvailable('https://chatgpt.com/c/12345'), true);
  assert.equal(parser.isAvailable('https://chatgpt.com/g/g-p-678'), true);
  assert.equal(parser.isAvailable('https://claude.ai/chat/123'), false);
  assert.equal(parser.isAvailable('https://openai.com'), false);
});

test('ChatGPTParser.cleanContent', () => {
  const parser = new ChatGPTParser();

  assert.equal(parser.cleanContent('Show moreShow less\n\n\n\nHello\n\n\nWorld'), 'Hello\n\nWorld');
  assert.equal(parser.cleanContent('  Some text   '), 'Some text');
  assert.equal(parser.cleanContent('Line 1\n\n\n\nLine 2'), 'Line 1\n\nLine 2');
});

test('ChatGPTParser.getRoleElement & getRoleElements', () => {
  const parser = new ChatGPTParser();

  const container = new MockElement('div');
  const roleEl = new MockElement('div', { 'data-message-author-role': 'user' });
  container.appendChild(roleEl);

  assert.equal(parser.getRoleElement(roleEl), roleEl);
  assert.equal(parser.getRoleElement(container), roleEl);
  assert.deepEqual(parser.getRoleElements(roleEl), [roleEl]);
  assert.deepEqual(parser.getRoleElements(container), [roleEl]);

  const emptyContainer = new MockElement('div');
  assert.equal(parser.getRoleElement(emptyContainer), null);
  assert.deepEqual(parser.getRoleElements(emptyContainer), []);
});

test('ChatGPTParser.getMessageRole', () => {
  const parser = new ChatGPTParser();

  const userRoleEl = new MockElement('div', { 'data-message-author-role': 'user' });
  assert.equal(parser.getMessageRole(new MockElement('div'), userRoleEl), 'User');

  const assistantRoleEl = new MockElement('div', { 'data-message-author-role': 'assistant' });
  assert.equal(parser.getMessageRole(new MockElement('div'), assistantRoleEl), 'ChatGPT');

  const containerWithYou1 = new MockElement('div', {}, 'You\nHello test');
  assert.equal(parser.getMessageRole(containerWithYou1, null), 'User');

  const containerWithYou2 = new MockElement('div', {}, 'Header\nYou\nHello test');
  assert.equal(parser.getMessageRole(containerWithYou2, null), 'User');

  const containerDefault = new MockElement('div', {}, 'Random content');
  assert.equal(parser.getMessageRole(containerDefault, null), 'ChatGPT');
});

test('ChatGPTParser.getContentElement & getContentElements', () => {
  const parser = new ChatGPTParser();

  const userRoleEl = new MockElement('div', { 'data-message-author-role': 'user' });
  assert.equal(parser.getContentElement(new MockElement('div'), userRoleEl), userRoleEl);

  const assistantContainer = new MockElement('article');
  const assistantRoleEl = new MockElement('div', { 'data-message-author-role': 'assistant' });
  const markdownEl = new MockElement('div', { class: 'markdown' });
  assistantRoleEl.appendChild(markdownEl);
  assistantContainer.appendChild(assistantRoleEl);

  assert.equal(parser.getContentElement(assistantContainer, assistantRoleEl), markdownEl);

  const proseContainer = new MockElement('div');
  const proseEl = new MockElement('div', { class: 'prose' });
  proseContainer.appendChild(proseEl);
  assert.equal(parser.getContentElement(proseContainer, null), proseEl);

  const fallbackArticle = new MockElement('article');
  assert.equal(parser.getContentElement(fallbackArticle, null), fallbackArticle);

  assert.deepEqual(parser.getContentElements(assistantContainer, [assistantRoleEl]), [markdownEl]);
});

test('ChatGPTParser.getMessageKey', () => {
  const parser = new ChatGPTParser();

  // Test data-message-id
  const msgContainer = new MockElement('div', { 'data-message-id': 'msg-123' });
  const roleEl = new MockElement('div', { 'data-message-author-role': 'user' });
  msgContainer.appendChild(roleEl);
  assert.equal(parser.getMessageKey(msgContainer, roleEl, 'User'), 'msg-123');

  // Test turn data-testid
  const turnContainer = new MockElement('section', { 'data-testid': 'conversation-turn-5' });
  const turnRoleEl = new MockElement('div', { 'data-message-author-role': 'assistant' });
  turnContainer.appendChild(turnRoleEl);
  assert.equal(parser.getMessageKey(turnContainer, turnRoleEl, 'ChatGPT'), 'conversation-turn-5:ChatGPT');

  // Test item index attribute
  const itemContainer = new MockElement('div', { 'data-item-index': '2' });
  const itemRoleEl = new MockElement('div', { 'data-message-author-role': 'user' });
  itemContainer.appendChild(itemRoleEl);
  assert.equal(parser.getMessageKey(itemContainer, itemRoleEl, 'User'), 'data-item-index:2:User:0');

  // Test fallback to element reference
  const simpleContainer = new MockElement('div');
  assert.equal(parser.getMessageKey(simpleContainer, null, 'ChatGPT'), simpleContainer);
});

test('ChatGPTParser.extractImages', () => {
  const parser = new ChatGPTParser();

  const container = new MockElement('div');
  const img1 = new MockElement('img', { src: 'https://chatgpt.com/backend-api/files/img1.png', alt: 'Sample Image' });
  const img2 = new MockElement('img', { src: 'blob:https://chatgpt.com/xyz', alt: 'Uploaded image' });
  const img3 = new MockElement('img', { src: 'https://chatgpt.com/backend-api/files/img1.png', alt: 'Duplicate' });
  const img4 = new MockElement('img', { src: 'https://example.com/avatar.png', alt: 'User Avatar' });

  container.appendChild(img1);
  container.appendChild(img2);
  container.appendChild(img3);
  container.appendChild(img4);

  const images = parser.extractImages(container);
  assert.deepEqual(images, [
    '![Sample Image](https://chatgpt.com/backend-api/files/img1.png)',
    '![Uploaded image](blob:https://chatgpt.com/xyz)',
  ]);
});

test('ChatGPTParser.appendAttachments', () => {
  const parser = new ChatGPTParser();

  const baseContent = 'This is the main response.';
  const attachments = [
    { name: 'document.pdf', type: 'PDF' },
    { name: 'notes.txt', type: 'Text' },
  ];
  const images = ['![Sample](https://chatgpt.com/backend-api/files/img1.png)'];

  const result = parser.appendAttachments(baseContent, attachments, images);

  assert.ok(result.includes('This is the main response.'));
  assert.ok(result.includes('**Attachments & Images:**'));
  assert.ok(result.includes('**PDF Files:**\n- document.pdf'));
  assert.ok(result.includes('**Text Files:**\n- notes.txt'));
  assert.ok(result.includes('**Images:**\n- ![Sample](https://chatgpt.com/backend-api/files/img1.png)'));

  // Test with no attachments or images
  assert.equal(parser.appendAttachments(baseContent, [], []), baseContent);
});

test('ChatGPTParser.extractMessage', () => {
  const parser = createConfiguredParser();

  const article = new MockElement('article', { 'data-message-id': 'msg-999' });
  const roleEl = new MockElement('div', { 'data-message-author-role': 'assistant' });
  const markdownEl = new MockElement('div', { class: 'markdown' }, 'Hello world from assistant.');
  const noiseBtn = new MockElement('button', {}, 'Copy');

  markdownEl.appendChild(noiseBtn);
  roleEl.appendChild(markdownEl);
  article.appendChild(roleEl);

  const message = parser.extractMessage(article);
  assert.deepEqual(message, {
    role: 'ChatGPT',
    content: 'Hello world from assistant.',
    key: 'msg-999',
  });

  // Test container with no content elements
  const emptyArticle = new MockElement('div');
  assert.equal(parser.extractMessage(emptyArticle), null);
});

test('ChatGPTParser.extractMountedMessages', () => {
  const parser = createConfiguredParser();

  const doc = new MockElement('div');
  const article = new MockElement('article', { 'data-message-id': 'msg-1' });
  const roleEl = new MockElement('div', { 'data-message-author-role': 'user' }, 'User prompt text');
  article.appendChild(roleEl);
  doc.appendChild(article);

  mockDocument.querySelectorAll = (selector) => findAll(doc, selector);
  mockDocument.querySelector = (selector) => findFirst(doc, selector);

  const messages = parser.extractMountedMessages();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'User');
  assert.equal(messages[0].content, 'User prompt text');
});

test('ChatGPTParser.parse options and fallback heuristics', async () => {
  const parser = createConfiguredParser();

  global.window = { location: { href: 'https://chatgpt.com/c/test-session' } };
  mockDocument.title = 'Test ChatGPT Session';

  const doc = new MockElement('div');
  mockDocument.querySelectorAll = (selector) => findAll(doc, selector);
  mockDocument.querySelector = (selector) => findFirst(doc, selector);

  // Mounted messages test
  const article = new MockElement('article', { 'data-message-id': 'msg-101' });
  const roleEl = new MockElement('div', { 'data-message-author-role': 'user' }, 'Mounted prompt text');
  article.appendChild(roleEl);
  doc.appendChild(article);

  const resultMounted = await parser.parse({ full: false });
  assert.equal(resultMounted.title, 'Test ChatGPT Session');
  assert.equal(resultMounted.messages.length, 1);
  assert.equal(resultMounted.metadata.Source, 'ChatGPT');
  assert.equal(resultMounted.metadata.Link, 'https://chatgpt.com/c/test-session');

  // Deep research iframe fallback test
  const emptyDoc = new MockElement('div');
  mockDocument.querySelectorAll = (selector) => findAll(emptyDoc, selector);
  mockDocument.querySelector = (selector) => findFirst(emptyDoc, selector);

  const iframe = new MockElement('iframe', { src: 'https://oaiusercontent.com/frame1' });
  const mainContent = new MockElement('main', {}, 'This is a prompt line?\n\nThis is a longer response from ChatGPT about research findings and detailed analysis.');
  emptyDoc.appendChild(iframe);
  emptyDoc.appendChild(mainContent);

  const resultIframe = await parser.parse({ full: false });
  assert.ok(resultIframe.messages.length > 0);
  assert.ok(resultIframe.messages.some(m => m.content.includes('iframe-based ChatGPT interface')));
});
