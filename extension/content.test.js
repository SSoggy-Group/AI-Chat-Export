const test = require('node:test');
const assert = require('node:assert');

// We need to mock browser globals before requiring content.js
// Setting readyState to loading prevents init() from triggering right away
global.document = {
  readyState: 'loading',
  createElement: () => ({}),
  addEventListener: () => {},
  body: {}
};
global.window = {
  addEventListener: () => {}
};
global.MutationObserver = class {
  observe() {}
};

// Mock excerpt utils since convertToJSON uses normalizeMessageMarkdown
global.ShareClaudeExcerptUtils = {
  transformExcerptBlocks: (msg, transform) => {
    // For test simplicity, just pass through the message
    // If the transformation logic becomes complex, we might want to actually require excerpt-utils.js
    return msg;
  }
};

const { convertToJSON } = require('./content.js');

test('convertToJSON', async (t) => {
    await t.test('returns valid JSON with title, exportedAt, and messages', () => {
        const title = "Test Conversation";
        const messages = [
            { source: "user", message: "Hello Claude" },
            { source: "assistant", message: "Hello! How can I help you?" }
        ];

        const result = convertToJSON(title, messages);
        const parsed = JSON.parse(result);

        assert.strictEqual(parsed.title, title);
        assert.deepStrictEqual(parsed.messages, [
            { source: "user", message: "Hello Claude" },
            { source: "assistant", message: "Hello! How can I help you?" }
        ]);

        // Check date logic
        assert.ok(parsed.exportedAt, "exportedAt should be present");
        const date = new Date(parsed.exportedAt);
        assert.ok(!isNaN(date.getTime()), "exportedAt should be a valid date");

        // Check formatting (2 spaces)
        assert.ok(result.includes('  "title": "Test Conversation"'), 'JSON should be formatted with 2 spaces');
    });

    await t.test('handles empty messages array', () => {
        const title = "Empty Chat";
        const messages = [];

        const result = convertToJSON(title, messages);
        const parsed = JSON.parse(result);

        assert.strictEqual(parsed.title, title);
        assert.deepStrictEqual(parsed.messages, []);
    });

    await t.test('normalizes message markdown correctly', () => {
        // Here we test integration with normalizeMessageMarkdown, but we mocked transformExcerptBlocks
        // Let's create a more realistic mock just for this test
        const originalTransform = global.ShareClaudeExcerptUtils.transformExcerptBlocks;

        // Mock to pretend it transforms something
        global.ShareClaudeExcerptUtils.transformExcerptBlocks = (msg) => {
            return msg + " (normalized)";
        };

        const title = "Markdown Test";
        const messages = [
            { source: "user", message: "Raw text" }
        ];

        const result = convertToJSON(title, messages);
        const parsed = JSON.parse(result);

        assert.strictEqual(parsed.messages[0].message, "Raw text (normalized)");

        // Restore original mock
        global.ShareClaudeExcerptUtils.transformExcerptBlocks = originalTransform;
    });
});
