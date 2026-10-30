import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeParser } from './content/parsers/claude.js';

// Setup minimal globals required for importing and basic execution
const originalFetch = global.fetch;
const originalWindow = global.window;
const originalDocument = global.document;
const originalChrome = global.chrome;

function setupGlobals() {
  if (typeof global.DOMParser === "undefined") {
    global.DOMParser = class DOMParser {
      parseFromString() {
        return { body: { innerText: "Sample text", textContent: "Sample text" } };
      }
    };
  }

  if (typeof global.HTMLElement === "undefined") {
    global.HTMLElement = class HTMLElement { cloneNode() { return this; } getElementsByTagName() { return []; } querySelectorAll() { return []; } remove() {} };
  }

  global.window = {
    location: {
      href: 'https://claude.ai/chat/test-chat-id-123',
      origin: 'https://claude.ai',
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
  };

  global.document = {
    title: 'Claude Test Chat',
    getElementById: (id) => (id === 'ai-export-claude-reader' ? { id } : null),
    createElement: () => ({ setAttribute: () => {}, querySelectorAll: () => [] }),
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
    querySelectorAll: () => [],
      remove: () => {},
    querySelector: () => null,
  };

  global.chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://mock-id/${path}`,
    },
  };

  if (!global.Node) {
    global.Node = {
      DOCUMENT_POSITION_DISCONNECTED: 1,
      DOCUMENT_POSITION_PRECEDING: 2,
      DOCUMENT_POSITION_FOLLOWING: 4,
      DOCUMENT_POSITION_CONTAINS: 8,
      DOCUMENT_POSITION_CONTAINED_BY: 16,
      DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32,
    };
  }
}

setupGlobals();

test('ClaudeParser.isAvailable', async (t) => {
  const parser = new ClaudeParser();

  await t.test('returns true for claude.ai URLs', () => {
    assert.equal(parser.isAvailable('https://claude.ai/chat/12345'), true);
    assert.equal(parser.isAvailable('https://subdomain.claude.ai/'), true);
  });

  await t.test('returns false for non-claude URLs', () => {
    assert.equal(parser.isAvailable('https://chatgpt.com/c/12345'), false);
    assert.equal(parser.isAvailable('https://gemini.google.com/app'), false);
  });
});

test('ClaudeParser.parseFromAPI', async (t) => {
  const parser = new ClaudeParser();

  t.afterEach(() => {
    global.fetch = originalFetch;
    global.window.location.href = 'https://claude.ai/chat/test-chat-id-123';
  });

  await t.test('returns null when URL does not contain a chat ID', async () => {
    global.window.location.href = 'https://claude.ai/chats';
    const result = await parser.parseFromAPI();
    assert.equal(result, null);
  });

  await t.test('returns null when organization endpoint fails with non-ok status', async () => {
    global.fetch = async (url) => {
      if (url.includes('/api/organizations')) {
        return { ok: false, status: 500 };
      }
      return { ok: false };
    };
    const result = await parser.parseFromAPI();
    assert.equal(result, null);
  });

  await t.test('returns null when organization list is empty or invalid', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return { ok: true, json: async () => [] };
      }
      return { ok: false };
    };
    const result = await parser.parseFromAPI();
    assert.equal(result, null);
  });

  await t.test('returns null when conversation endpoint fails with non-ok status', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return { ok: false, status: 404 };
    };
    const result = await parser.parseFromAPI();
    assert.equal(result, null);
  });

  await t.test('returns null when conversation payload is missing chat_messages', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return {
        ok: true,
        json: async () => ({ name: 'Test Chat', chat_messages: [] }),
      };
    };
    const result = await parser.parseFromAPI();
    assert.equal(result, null);
  });

  await t.test('successfully parses complex conversation from API', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return {
          ok: true,
          json: async () => [
            { uuid: 'org-no-chat', capabilities: [] },
            { uuid: 'org-chat-uuid', capabilities: ['chat'] },
          ],
        };
      }
      if (url.includes('/org-chat-uuid/chat_conversations/test-chat-id-123')) {
        return {
          ok: true,
          json: async () => ({
            name: 'API Parsed Conversation Title',
            model: 'claude-3-5-sonnet-20241022',
            chat_messages: [
              {
                sender: 'human',
                content: 'Hello Claude, check this out.',
                attachments: [
                  {
                    file_type: 'text/markdown',
                    file_name: 'doc.md',
                    extracted_content: 'Markdown content',
                  },
                ],
                files_v2: [{ file_name: 'blob.png' }],
              },
              {
                sender: 'assistant',
                content: [
                  { type: 'thinking', thinking: 'Let me analyze the prompt.' },
                  { type: 'text', text: 'Here is your artifact and code snippet.' },
                  {
                    type: 'tool_use',
                    name: 'artifacts',
                    input: {
                      id: 'art-1',
                      title: 'My React Component',
                      language: 'jsx',
                      content: 'export default () => <div>Hello</div>;',
                    },
                  },
                  {
                    type: 'tool_use',
                    name: 'repl',
                    input: {
                      code: 'console.log("executing REPL");',
                    },
                  },
                  {
                    type: 'tool_use',
                    name: 'unknown_tool',
                    input: { data: 123 },
                  },
                ],
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const result = await parser.parseFromAPI();
    assert.notEqual(result, null);
    assert.equal(result.title, 'API Parsed Conversation Title');
    assert.equal(result.metadata.Source, 'Claude');
    assert.equal(result.metadata.Model, 'claude-3-5-sonnet-20241022');
    assert.equal(result.metadata.Link, 'https://claude.ai/chat/test-chat-id-123');

    assert.equal(result.messages.length, 2);

    // User message assertions
    const userMsg = result.messages[0];
    assert.equal(userMsg.role, 'User');
    assert.ok(userMsg.content.includes('Hello Claude, check this out.'));
    assert.ok(userMsg.content.includes('doc.md:\n\n```markdown\nMarkdown content\n```'));
    assert.ok(userMsg.content.includes("blob.png (can't show blob content)"));

    // Assistant message assertions
    const assistantMsg = result.messages[1];
    assert.equal(assistantMsg.role, 'Claude');
    assert.equal(assistantMsg.thinking, 'Let me analyze the prompt.');
    assert.ok(assistantMsg.content.includes('Here is your artifact and code snippet.'));
    assert.ok(assistantMsg.content.includes('> **Artifact: My React Component**'));
    assert.ok(assistantMsg.content.includes('```jsx\nexport default () => <div>Hello</div>;\n```'));
    assert.ok(assistantMsg.content.includes('```javascript\nconsole.log("executing REPL");\n```'));
  });
});

test('ClaudeParser.parseFromDOM', async (t) => {
  const parser = new ClaudeParser();

  await t.test('handles empty DOM gracefully', async () => {
    const result = await parser.parseFromDOM();
    assert.equal(result.title, 'Claude Test Chat');
    assert.deepEqual(result.messages, []);
    assert.equal(result.metadata.Source, 'Claude');
  });
});

test('ClaudeParser.parse', async (t) => {
  const parser = new ClaudeParser();

  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test('returns API result when API succeeds and has messages', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return {
        ok: true,
        json: async () => ({
          name: 'API Chat',
          chat_messages: [{ sender: 'human', content: 'Hello' }],
        }),
      };
    };

    const result = await parser.parse();
    assert.equal(result.title, 'API Chat');
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].content, 'Hello');
  });

  await t.test('falls back to parseFromDOM when API returns empty messages', async () => {
    global.fetch = async (url) => {
      if (url.endsWith('/api/organizations')) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return {
        ok: true,
        json: async () => ({
          name: 'API Chat',
          chat_messages: [],
        }),
      };
    };

    const result = await parser.parse();
    assert.equal(result.title, 'Claude Test Chat');
    assert.deepEqual(result.messages, []);
  });

  await t.test('falls back to parseFromDOM when API returns null', async () => {
    global.fetch = async () => ({ ok: false, status: 500 });

    const result = await parser.parse();
    assert.equal(result.title, 'Claude Test Chat');
    assert.deepEqual(result.messages, []);
  });

  await t.test('falls back to parseFromDOM when API fetch throws an error', async () => {
    global.fetch = async () => {
      throw new Error('Network failure');
    };

    const result = await parser.parse();
    assert.equal(result.title, 'Claude Test Chat');
    assert.deepEqual(result.messages, []);
  });
});

test('ClaudeParser parseFromDOM DOM querying performance benchmark', async (t) => {
  try {
  const parser = new ClaudeParser();

  const mockElements = [];
  const artifactElements = [];

  for (let i = 0; i < 200; i++) {
    const isUser = i % 2 === 0;
    const isArtifact = i % 10 === 0 && !isUser;

    const parentContainer = {
      testId: isUser ? 'user-message' : null,
      itemIndex: Math.floor(i / 2).toString(),
      parent: null,
      getAttribute: (attr) => (attr === 'data-item-index' || attr === 'data-index') ? Math.floor(i / 2).toString() : null,
    };

    const className = isArtifact
      ? 'artifact-block-cell'
      : isUser
        ? 'font-claude-message'
        : 'font-claude-response';

    const el = {
      tagName: 'DIV',
      nodeType: 1,
      nodeName: 'DIV',
      childNodes: [],
      className,
      innerText: 'Message content line ' + i,
      textContent: 'Message content line ' + i,
      parent: parentContainer,
      cloneNode: function() {
        const cloned = {
          nodeType: 1,
          nodeName: 'DIV',
          childNodes: [],
          className: this.className,
          innerText: this.innerText,
          textContent: this.textContent,
          getElementsByTagName: () => [],
          remove: () => {},
          querySelectorAll: () => [],
      remove: () => {},
          getAttribute: () => null,
          cloneNode: function() { return this; },
        };
        Object.setPrototypeOf(cloned, global.HTMLElement.prototype);
        return cloned;
      },
      querySelectorAll: () => [],
      remove: () => {},
      querySelector: () => null,
      getElementsByTagName: () => [],
          remove: () => {},
      getAttribute: (attr) => (attr === 'data-item-index' || attr === 'data-index') ? parentContainer.itemIndex : null,
      matches: function(selector) {
        if (selector.includes('.artifact-block-cell')) return this.className.includes('artifact-block-cell');
        if (selector.includes('[data-testid="user-message"]')) return parentContainer.testId === 'user-message';
        if (selector.includes('.font-claude-message')) return this.className.includes('font-claude-message');
        if (selector.includes('.font-claude-response')) return this.className.includes('font-claude-response');
        return false;
      },
      closest: function(selector) {
        if (selector.includes('[data-testid="user-message"]')) {
          return parentContainer.testId === 'user-message' ? parentContainer : null;
        }
        if (selector.includes('[data-item-index]') || selector.includes('[data-index]')) {
          return parentContainer.itemIndex !== null ? parentContainer : null;
        }
        return null;
      },
      compareDocumentPosition: () => 4,
      contains: () => false,
    };

    Object.setPrototypeOf(el, global.HTMLElement.prototype);
    mockElements.push(el);
    if (isArtifact) {
      artifactElements.push(el);
    }
  }

  const origGEBI = global.document.getElementById;
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { if (typeof fn === "function") fn(); return 0; };
  const origQSA = global.document.querySelectorAll;
  global.document.querySelectorAll = (selector) => {
    if (selector.includes('.artifact-block-cell')) return artifactElements;
    return mockElements;
  };

  const iterations = 50;
  const start = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    try {
      await parser.parseFromDOM();
    } catch (e) {
      console.error('CRITICAL BENCHMARK ERROR:', e);
      throw e;
    }
  }
  const duration = performance.now() - start;
  console.log(`[Benchmark] parseFromDOM ${iterations} iterations took ${duration.toFixed(2)} ms`);

  global.document.querySelectorAll = origQSA;
  global.setTimeout = origSetTimeout;
  global.document.getElementById = origGEBI;
  } catch (err) {
    console.error("BENCHMARK EXCEPTION:", err);
  }
});
