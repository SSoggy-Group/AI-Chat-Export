const test = require('node:test');
const assert = require('node:assert/strict');

// Mock browser globals before loading modules
if (!global.window) {
  global.window = {
    location: {
      href: 'https://claude.ai/chat/conv-12345',
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
    createElement: () => ({
      src: '',
      id: '',
      onload: null,
      remove: () => {},
    }),
    head: {
      appendChild: () => {},
    },
    documentElement: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
  };
}

if (!global.chrome) {
  global.chrome = {
    runtime: {
      getURL: (path) => path,
    },
  };
}

test('ClaudeParser module tests', async (t) => {
  const { ClaudeParser } = await import('./content/parsers/claude.js');
  const parser = new ClaudeParser();

  await t.test('isAvailable returns true for claude.ai URLs and false otherwise', () => {
    assert.equal(parser.isAvailable('https://claude.ai/chat/12345'), true);
    assert.equal(parser.isAvailable('https://claude.ai/'), true);
    assert.equal(parser.isAvailable('https://chatgpt.com/'), false);
    assert.equal(parser.isAvailable('https://gemini.google.com/'), false);
  });

  await t.test('parseFromAPI returns null if URL lacks conversation ID', async () => {
    const origHref = global.window.location.href;
    global.window.location.href = 'https://claude.ai/chats';
    try {
      const result = await parser.parseFromAPI();
      assert.equal(result, null);
    } finally {
      global.window.location.href = origHref;
    }
  });

  await t.test('parseFromAPI returns null if organizations request fails or returns empty array', async () => {
    const origFetch = global.fetch;
    global.window.location.href = 'https://claude.ai/chat/conv-12345';

    // Failed response
    global.fetch = async () => ({ ok: false });
    assert.equal(await parser.parseFromAPI(), null);

    // Empty array
    global.fetch = async () => ({
      ok: true,
      json: async () => [],
    });
    assert.equal(await parser.parseFromAPI(), null);

    // Invalid JSON structure (not array)
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ error: 'not an array' }),
    });
    assert.equal(await parser.parseFromAPI(), null);

    global.fetch = origFetch;
  });

  await t.test('parseFromAPI returns null if org has no uuid or conversation request fails', async () => {
    const origFetch = global.fetch;
    global.window.location.href = 'https://claude.ai/chat/conv-12345';

    // Org missing uuid
    global.fetch = async () => ({
      ok: true,
      json: async () => [{ capabilities: ['chat'] }],
    });
    assert.equal(await parser.parseFromAPI(), null);

    // Conversation request fails
    global.fetch = async (url) => {
      if (url.includes('/organizations')) {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-1', capabilities: ['chat'] }],
        };
      }
      return { ok: false };
    };
    assert.equal(await parser.parseFromAPI(), null);

    global.fetch = origFetch;
  });

  await t.test('parseFromAPI returns null if conversation has no chat_messages', async () => {
    const origFetch = global.fetch;
    global.window.location.href = 'https://claude.ai/chat/conv-12345';

    global.fetch = async (url) => {
      if (url === 'https://claude.ai/api/organizations') {
        return {
          ok: true,
          json: async () => [{ uuid: 'org-1', capabilities: ['chat'] }],
        };
      }
      return {
        ok: true,
        json: async () => ({ name: 'Test Chat', chat_messages: [] }),
      };
    };

    assert.equal(await parser.parseFromAPI(), null);

    global.fetch = origFetch;
  });

  await t.test('parseFromAPI successfully parses messages, attachments, thinking, and tool uses', async () => {
    const origFetch = global.fetch;
    global.window.location.href = 'https://claude.ai/chat/conv-12345';

    global.fetch = async (url) => {
      if (url === 'https://claude.ai/api/organizations') {
        return {
          ok: true,
          json: async () => [
            { uuid: 'org-default' },
            { uuid: 'org-chat', capabilities: ['chat'] },
          ],
        };
      }

      if (url.includes('/chat_conversations/conv-12345')) {
        return {
          ok: true,
          json: async () => ({
            name: 'API Parsed Chat',
            model: 'claude-3-5-sonnet',
            chat_messages: [
              {
                sender: 'human',
                content: 'Hello, please process my code and attachment.',
                attachments: [
                  {
                    file_type: 'text/javascript',
                    file_name: 'script.js',
                    extracted_content: 'console.log("hello");',
                  },
                  {
                    file_type: 'plain',
                    file_name: 'plain.txt',
                    extracted_content: 'Plain text content',
                  },
                ],
                files_v2: [
                  { file_name: 'blob_only.png' },
                ],
              },
              {
                sender: 'assistant',
                content: [
                  {
                    type: 'thinking',
                    thinking: 'First I need to analyze the question.',
                  },
                  {
                    type: 'thinking',
                    thinking: 'Second step of thinking.',
                  },
                  {
                    type: 'text',
                    text: 'Here is an artifact and REPL run:',
                  },
                  {
                    type: 'tool_use',
                    name: 'artifacts',
                    input: {
                      id: 'art-1',
                      title: 'My Artifact',
                      language: 'javascript',
                      content: 'const x = 42;',
                    },
                  },
                  {
                    type: 'tool_use',
                    name: 'repl',
                    input: {
                      code: 'Math.sqrt(16)',
                    },
                  },
                  {
                    type: 'tool_use',
                    name: 'other_unknown_tool',
                    input: {},
                  },
                  {
                    type: 'unknown_type',
                    text: '\n\nDone!',
                  },
                ],
              },
              {
                sender: 'user',
                content: 'Thank you!',
              },
            ],
          }),
        };
      }

      return { ok: false };
    };

    const result = await parser.parseFromAPI();

    assert.ok(result);
    assert.equal(result.title, 'API Parsed Chat');
    assert.equal(result.metadata.Source, 'Claude');
    assert.equal(result.metadata.Link, 'https://claude.ai/chat/conv-12345');
    assert.equal(result.metadata.Model, 'claude-3-5-sonnet');
    assert.ok(result.metadata.Date);

    assert.equal(result.messages.length, 3);

    // Message 0: Human user with attachments
    assert.equal(result.messages[0].role, 'User');
    assert.ok(result.messages[0].content.includes('Hello, please process my code and attachment.'));
    assert.ok(result.messages[0].content.includes('script.js:\n\n```javascript\nconsole.log("hello");\n```'));
    assert.ok(result.messages[0].content.includes('plain.txt:\n\n```plain\nPlain text content\n```'));
    assert.ok(result.messages[0].content.includes("blob_only.png (can't show blob content)"));

    // Message 1: Claude response with thinking and artifacts
    assert.equal(result.messages[1].role, 'Claude');
    assert.equal(result.messages[1].thinking, 'First I need to analyze the question.\n\nSecond step of thinking.');
    assert.ok(result.messages[1].content.includes('Here is an artifact and REPL run:'));
    assert.ok(result.messages[1].content.includes('> **Artifact: My Artifact**\n```javascript\nconst x = 42;\n```'));
    assert.ok(result.messages[1].content.includes('```javascript\nMath.sqrt(16)\n```'));
    assert.ok(result.messages[1].content.includes('Done!'));

    // Message 2: Short user message
    assert.equal(result.messages[2].role, 'User');
    assert.equal(result.messages[2].content, 'Thank you!');

    global.fetch = origFetch;
  });

  await t.test('parse fallback logic uses parseFromAPI and falls back to parseFromDOM on failure', async () => {
    let apiCalled = false;
    let domCalled = false;

    // Test API success case
    parser.parseFromAPI = async () => {
      apiCalled = true;
      return {
        title: 'API Title',
        messages: [{ role: 'User', content: 'Hi' }],
        metadata: {},
      };
    };
    parser.parseFromDOM = async () => {
      domCalled = true;
      return {
        title: 'DOM Title',
        messages: [{ role: 'User', content: 'Hi DOM' }],
        metadata: {},
      };
    };

    let result = await parser.parse();
    assert.equal(apiCalled, true);
    assert.equal(domCalled, false);
    assert.equal(result.title, 'API Title');

    // Test API failure / empty response falling back to DOM
    apiCalled = false;
    domCalled = false;
    parser.parseFromAPI = async () => {
      apiCalled = true;
      return null;
    };

    result = await parser.parse();
    assert.equal(apiCalled, true);
    assert.equal(domCalled, true);
    assert.equal(result.title, 'DOM Title');

    // Test API throw falling back to DOM
    apiCalled = false;
    domCalled = false;
    parser.parseFromAPI = async () => {
      apiCalled = true;
      throw new Error('Network error');
    };

    result = await parser.parse();
    assert.equal(apiCalled, true);
    assert.equal(domCalled, true);
    assert.equal(result.title, 'DOM Title');
  });
});
