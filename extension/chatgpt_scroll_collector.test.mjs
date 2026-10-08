import test from 'node:test';
import assert from 'node:assert';
import {
  getConversationTurnIndex,
  getConversationTurns,
  findChatGPTScrollRoot,
  collectMountedTurnMessages,
} from './content/parsers/chatgpt_scroll_collector.js';

test('getConversationTurnIndex', async (t) => {
  await t.test('returns numeric index for valid conversation-turn data-testid formats', () => {
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: (attr) => attr === 'data-testid' ? 'conversation-turn-0' : null }),
      0
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: (attr) => attr === 'data-testid' ? 'conversation-turn-1' : null }),
      1
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: (attr) => attr === 'data-testid' ? 'conversation-turn-42' : null }),
      42
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: (attr) => attr === 'data-testid' ? 'conversation-turn-999' : null }),
      999
    );
  });

  await t.test('returns POSITIVE_INFINITY for invalid or non-matching data-testid formats', () => {
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => 'something-else' }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => 'conversation-turn-' }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => 'conversation-turn-abc' }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => 'conversation-turn-1-extra' }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => 'prefix-conversation-turn-1' }),
      Number.POSITIVE_INFINITY
    );
  });

  await t.test('returns POSITIVE_INFINITY when data-testid attribute is missing or empty', () => {
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => null }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => undefined }),
      Number.POSITIVE_INFINITY
    );
    assert.strictEqual(
      getConversationTurnIndex({ getAttribute: () => '' }),
      Number.POSITIVE_INFINITY
    );
  });

  await t.test('returns POSITIVE_INFINITY when turn element is null, undefined, or missing getAttribute', () => {
    assert.strictEqual(getConversationTurnIndex(null), Number.POSITIVE_INFINITY);
    assert.strictEqual(getConversationTurnIndex(undefined), Number.POSITIVE_INFINITY);
    assert.strictEqual(getConversationTurnIndex({}), Number.POSITIVE_INFINITY);
    assert.strictEqual(getConversationTurnIndex({ getAttribute: 'not-a-function' }), Number.POSITIVE_INFINITY);
    assert.strictEqual(getConversationTurnIndex(123), Number.POSITIVE_INFINITY);
    assert.strictEqual(getConversationTurnIndex('element-string'), Number.POSITIVE_INFINITY);
  });

  await t.test('works with mock or standard DOM element objects', () => {
    const mockElement = {
      getAttribute(attr) {
        if (attr === 'data-testid') return 'conversation-turn-15';
        return null;
      },
    };
    assert.strictEqual(getConversationTurnIndex(mockElement), 15);
  });
});

test('findChatGPTScrollRoot', () => {
  const scrollableElement = {
    scrollHeight: 1000,
    clientHeight: 400,
  };

  const docWithScrollRoot = {
    querySelector: (selector) => {
      if (selector === '[data-scroll-root]') return scrollableElement;
      return null;
    },
  };

  assert.strictEqual(findChatGPTScrollRoot([], docWithScrollRoot), scrollableElement);
});

test('collectMountedTurnMessages collects across virtualized scroll steps', async () => {
  // Simulate a scroll container with 3 turns
  // Turn 1 and 2 are mounted at scrollTop = 0
  // Turn 3 and 4 only mount when scrollTop >= 300
  const scrollRoot = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
  };

  const doc = {
    querySelectorAll: (selector) => {
      if (selector.startsWith('section[data-testid^="conversation-turn-"]')) {
        const turns = [
          {
            getAttribute: () => 'conversation-turn-1',
            id: 'turn-1',
          },
          {
            getAttribute: () => 'conversation-turn-2',
            id: 'turn-2',
          },
        ];
        if (scrollRoot.scrollTop >= 300) {
          turns.push(
            {
              getAttribute: () => 'conversation-turn-3',
              id: 'turn-3',
            },
            {
              getAttribute: () => 'conversation-turn-4',
              id: 'turn-4',
            }
          );
        }
        return turns;
      }
      return [];
    },
  };

  const extractMessage = (turn) => {
    const messages = {
      'turn-1': { role: 'User', content: 'Prompt 1', key: 'msg-1' },
      'turn-2': { role: 'ChatGPT', content: 'Response 1', key: 'msg-2' },
      'turn-3': { role: 'User', content: 'Prompt 2', key: 'msg-3' },
      'turn-4': { role: 'ChatGPT', content: 'Response 2', key: 'msg-4' },
    };
    return messages[turn.id] || null;
  };

  const results = await collectMountedTurnMessages({
    scrollRoot,
    extractMessage,
    waitForRender: async () => {},
    doc,
  });

  assert.strictEqual(results.length, 4, 'Should collect all 4 messages across virtualized scrolling');
  assert.strictEqual(results[0].content, 'Prompt 1');
  assert.strictEqual(results[1].content, 'Response 1');
  assert.strictEqual(results[2].content, 'Prompt 2');
  assert.strictEqual(results[3].content, 'Response 2');
  assert.strictEqual(scrollRoot.scrollTop, 0, 'Original scroll position should be restored');
});

test('collectMountedTurnMessages ignores role elements inside turns to avoid duplicates', async () => {
  const turnElement = {
    getAttribute: (attr) => (attr === 'data-testid' ? 'conversation-turn-1' : null),
    id: 'turn-1',
  };

  const innerRoleElement = {
    closest: (sel) => (sel.includes('conversation-turn') ? turnElement : null),
    getAttribute: () => null,
    id: 'inner-role-1',
  };

  const standaloneRoleElement = {
    closest: () => null,
    getAttribute: () => null,
    id: 'standalone-role-2',
  };

  const doc = {
    querySelectorAll: (selector) => {
      if (selector.startsWith('section[data-testid^="conversation-turn-"]')) {
        return [turnElement];
      }
      if (selector === '[data-message-author-role]') {
        return [innerRoleElement, standaloneRoleElement];
      }
      return [];
    },
  };

  const extractMessage = (el) => {
    if (el.id === 'turn-1') return { role: 'User', content: 'Turn Prompt', key: 'turn-1' };
    if (el.id === 'inner-role-1') return { role: 'User', content: 'Turn Prompt', key: 'diff-key' };
    if (el.id === 'standalone-role-2') return { role: 'ChatGPT', content: 'Standalone Response', key: 'standalone-2' };
    return null;
  };

  const results = await collectMountedTurnMessages({
    extractMessage,
    waitForRender: async () => {},
    doc,
  });

  assert.strictEqual(results.length, 2, 'Should only contain the turn and the standalone element, no duplicate');
  assert.strictEqual(results[0].content, 'Turn Prompt');
  assert.strictEqual(results[1].content, 'Standalone Response');
});
