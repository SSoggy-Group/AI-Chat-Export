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
global.AIChatExportExcerptUtils = {
  transformExcerptBlocks: (msg, transform) => {
    // For test simplicity, just pass through the message
    // If the transformation logic becomes complex, we might want to actually require excerpt-utils.js
    return msg;
  }
};

const { convertToJSON } = require('./export-utils.js');

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
        const originalTransform = global.AIChatExportExcerptUtils.transformExcerptBlocks;

        // Mock to pretend it transforms something
        global.AIChatExportExcerptUtils.transformExcerptBlocks = (msg) => {
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
        global.AIChatExportExcerptUtils.transformExcerptBlocks = originalTransform;
    });

    await t.test("convertToHTML sanitizes link hrefs against XSS", () => {
        const { convertToHTML } = require("./export-utils.js");
        const title = "XSS Link Test";
        const messages = [
            { source: "user", message: "[Safe link](https://example.com/path?a=1&b=2)" },
            { source: "user", message: "[Malicious JS](javascript:alert(1))" },
            { source: "user", message: "[Obfuscated JS]( java\tscript:alert(1) )" },
            { source: "user", message: "[Attribute Injection](https://example.com\"onclick=\"alert(1))" },
            { source: "user", message: "[Relative Link](/path/to/page#anchor)" }
        ];

        const html = convertToHTML(title, messages);

        assert.ok(html.includes('<a href="https://example.com/path?a=1&amp;b=2">Safe link</a>'), "Safe HTTP/HTTPS links should be allowed and escaped");
        assert.ok(html.includes('<a href="#">Malicious JS</a>'), "javascript: links should be sanitized to #");
        assert.ok(html.includes('<a href="#">Obfuscated JS</a>'), "Obfuscated javascript: links with control chars should be sanitized to #");
        assert.ok(html.includes('<a href="https://example.com&quot;onclick=&quot;alert(1">Attribute Injection</a>)'), "Double quotes in href should be escaped");
        assert.ok(html.includes('<a href="/path/to/page#anchor">Relative Link</a>'), "Relative links should be preserved");
    });
});
