import test from 'node:test';
import assert from 'node:assert/strict';

// Set up minimal browser globals required for importing and testing ClaudeParser
if (!global.window) {
  global.window = {
    location: {
      href: 'https://claude.ai/chat/test-chat-id-123',
      origin: 'https://claude.ai',
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
  };
}

if (!global.document) {
  global.document = {
    title: 'Test Claude Chat',
    getElementById: () => null,
    createElement: () => ({
      setAttribute: () => {},
      remove: () => {},
      addEventListener: () => {},
    }),
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    scrollingElement: null,
  };
}

if (!global.chrome) {
  global.chrome = {
    runtime: {
      getURL: (path) => path,
    },
  };
}

const { ClaudeParser } = await import('./content/parsers/claude.js');

test('ClaudeParser.parse() fallback and error handling', async (t) => {
  await t.test('falls back to parseFromDOM when parseFromAPI throws an error', async () => {
    const parser = new ClaudeParser();
    let domCalled = false;
    let warnLogged = false;

    // Spy console.warn
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && args[0].includes('[ClaudeParser] API fetch failed')) {
        warnLogged = true;
      }
      originalWarn(...args);
    };

    // Mock parseFromAPI to throw an error
    parser.parseFromAPI = async () => {
      throw new Error('Network error during API fetch');
    };

    // Mock parseFromDOM
    const expectedDOMResult = {
      title: 'DOM Chat Title',
      messages: [{ role: 'User', content: 'Hello from DOM' }],
      metadata: { Source: 'Claude' },
    };
    parser.parseFromDOM = async () => {
      domCalled = true;
      return expectedDOMResult;
    };

    try {
      const result = await parser.parse();
      assert.strictEqual(domCalled, true, 'parseFromDOM should have been called');
      assert.strictEqual(warnLogged, true, 'console.warn should have logged API failure');
      assert.deepStrictEqual(result, expectedDOMResult);
    } finally {
      console.warn = originalWarn;
    }
  });

  await t.test('falls back to parseFromDOM when parseFromAPI returns null', async () => {
    const parser = new ClaudeParser();
    let domCalled = false;

    parser.parseFromAPI = async () => null;
    const expectedDOMResult = {
      title: 'DOM Chat Title',
      messages: [{ role: 'User', content: 'Hello from DOM' }],
      metadata: { Source: 'Claude' },
    };
    parser.parseFromDOM = async () => {
      domCalled = true;
      return expectedDOMResult;
    };

    const result = await parser.parse();
    assert.strictEqual(domCalled, true, 'parseFromDOM should have been called');
    assert.deepStrictEqual(result, expectedDOMResult);
  });

  await t.test('falls back to parseFromDOM when parseFromAPI returns empty messages', async () => {
    const parser = new ClaudeParser();
    let domCalled = false;

    parser.parseFromAPI = async () => ({
      title: 'API Title',
      messages: [],
      metadata: {},
    });
    const expectedDOMResult = {
      title: 'DOM Chat Title',
      messages: [{ role: 'User', content: 'Hello from DOM' }],
      metadata: { Source: 'Claude' },
    };
    parser.parseFromDOM = async () => {
      domCalled = true;
      return expectedDOMResult;
    };

    const result = await parser.parse();
    assert.strictEqual(domCalled, true, 'parseFromDOM should have been called');
    assert.deepStrictEqual(result, expectedDOMResult);
  });

  await t.test('returns API result and skips parseFromDOM when parseFromAPI succeeds', async () => {
    const parser = new ClaudeParser();
    let domCalled = false;

    const apiResult = {
      title: 'API Chat Title',
      messages: [{ role: 'User', content: 'Hello from API' }],
      metadata: { Source: 'Claude' },
    };
    parser.parseFromAPI = async () => apiResult;
    parser.parseFromDOM = async () => {
      domCalled = true;
      return { title: 'DOM Title', messages: [], metadata: {} };
    };

    const result = await parser.parse();
    assert.strictEqual(domCalled, false, 'parseFromDOM should not be called when API succeeds');
    assert.deepStrictEqual(result, apiResult);
  });
});

test('ClaudeParser.parseFromAPI direct behavior and error cases', async (t) => {
  await t.test('returns null if window.location does not contain conversation ID', async () => {
    const parser = new ClaudeParser();
    const origHref = window.location.href;
    window.location.href = 'https://claude.ai/chats';
    try {
      const result = await parser.parseFromAPI();
      assert.strictEqual(result, null);
    } finally {
      window.location.href = origHref;
    }
  });

  await t.test('returns null when org fetch returns non-OK status', async () => {
    const parser = new ClaudeParser();
    const origFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 401,
    });
    try {
      const result = await parser.parseFromAPI();
      assert.strictEqual(result, null);
    } finally {
      global.fetch = origFetch;
    }
  });

  await t.test('returns null when org list is empty', async () => {
    const parser = new ClaudeParser();
    const origFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [],
    });
    try {
      const result = await parser.parseFromAPI();
      assert.strictEqual(result, null);
    } finally {
      global.fetch = origFetch;
    }
  });

  await t.test('returns null when conversation fetch returns non-OK status', async () => {
    const parser = new ClaudeParser();
    const origFetch = global.fetch;
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return {
        ok: false,
        status: 404,
      };
    };
    try {
      const result = await parser.parseFromAPI();
      assert.strictEqual(result, null);
    } finally {
      global.fetch = origFetch;
    }
  });

  await t.test('returns null when conversation data has empty chat_messages', async () => {
    const parser = new ClaudeParser();
    const origFetch = global.fetch;
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 1) {
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
    try {
      const result = await parser.parseFromAPI();
      assert.strictEqual(result, null);
    } finally {
      global.fetch = origFetch;
    }
  });

  await t.test('successfully parses API payload when response is valid', async () => {
    const parser = new ClaudeParser();
    const origFetch = global.fetch;
    let callCount = 0;
    global.fetch = async (url) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-123', capabilities: ['chat'] }],
        };
      }
      return {
        ok: true,
        json: async () => ({
          name: 'Test Conversation',
          model: 'claude-3-5-sonnet',
          chat_messages: [
            {
              sender: 'human',
              content: 'What is 2+2?',
            },
            {
              sender: 'assistant',
              content: [
                { type: 'thinking', thinking: 'Simple math problem' },
                { type: 'text', text: '4' },
              ],
            },
          ],
        }),
      };
    };
    try {
      const result = await parser.parseFromAPI();
      assert.notStrictEqual(result, null);
      assert.strictEqual(result.title, 'Test Conversation');
      assert.strictEqual(result.messages.length, 2);
      assert.deepStrictEqual(result.messages[0], { role: 'User', content: 'What is 2+2?' });
      assert.deepStrictEqual(result.messages[1], { role: 'Claude', content: '4', thinking: 'Simple math problem' });
      assert.strictEqual(result.metadata.Model, 'claude-3-5-sonnet');
    } finally {
      global.fetch = origFetch;
    }
  });
});
