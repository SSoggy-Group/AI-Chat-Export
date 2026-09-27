import test from 'node:test';
import assert from 'node:assert';
import {
  getConversationTurnIndex,
  getConversationTurns,
  findChatGPTScrollRoot,
  collectMountedTurnMessages,
} from './content/parsers/chatgpt_scroll_collector.js';

test('getConversationTurnIndex', () => {
  assert.strictEqual(
    getConversationTurnIndex({ getAttribute: () => 'conversation-turn-1' }),
    1
  );
  assert.strictEqual(
    getConversationTurnIndex({ getAttribute: () => 'conversation-turn-42' }),
    42
  );
  assert.strictEqual(
    getConversationTurnIndex({ getAttribute: () => 'something-else' }),
    Number.POSITIVE_INFINITY
  );
  assert.strictEqual(
    getConversationTurnIndex(null),
    Number.POSITIVE_INFINITY
  );
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
