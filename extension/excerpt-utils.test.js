const test = require('node:test');
const assert = require('node:assert');

// Load the script. It registers ShareClaudeExcerptUtils on globalThis.
require('./excerpt-utils.js');
const { splitTextOnExcerpts, transformExcerptBlocks } = globalThis.ShareClaudeExcerptUtils;

test('splitTextOnExcerpts', async (t) => {
    await t.test('empty string', () => {
        const result = splitTextOnExcerpts('');
        assert.deepStrictEqual(result, [{ type: 'markdown', content: '' }]);
    });

    await t.test('text without excerpts', () => {
        const text = 'Hello world\n\nThis is just normal text.';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [{ type: 'markdown', content: text }]);
    });

    await t.test('single plain excerpt', () => {
        const text = 'Before excerpt\n\nexcerpt_from_previous_claude_message.txt:\n\nThis is the excerpt content\n\nAfter excerpt';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: 'Before excerpt\n\n' },
            { type: 'excerpt', content: 'This is the excerpt content' },
            { type: 'markdown', content: '\n\nAfter excerpt' }
        ]);
    });

    await t.test('single plain excerpt ending at EOF', () => {
        const text = 'Before excerpt\n\nexcerpt_from_previous_claude_message.txt:\n\nThis is the excerpt content';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: 'Before excerpt\n\n' },
            { type: 'excerpt', content: 'This is the excerpt content' }
        ]);
    });

    await t.test('single fenced excerpt', () => {
        const text = 'Before excerpt\n\nexcerpt_from_previous_claude_message.txt:\n\n```js\nconst x = 1;\n```\nAfter excerpt';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: 'Before excerpt\n\n' },
            { type: 'excerpt', content: 'const x = 1;' },
            { type: 'markdown', content: '\nAfter excerpt' }
        ]);
    });

    await t.test('fenced excerpt with no content inside', () => {
        const text = 'excerpt_from_previous_claude_message.txt:\n\n```\n\n```\nAfter';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: '\nAfter' }
        ]);
    });

    await t.test('multiple excerpts', () => {
        const text = 'First.\n\nexcerpt_from_previous_claude_message.txt:\n\nExcerpt 1\n\nMiddle.\n\nexcerpt_from_previous_claude_message.txt:\n\n```\nExcerpt 2\n```\n\nEnd.';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: 'First.\n\n' },
            { type: 'excerpt', content: 'Excerpt 1' },
            { type: 'markdown', content: '\n\nMiddle.\n\n' },
            { type: 'excerpt', content: 'Excerpt 2' },
            { type: 'markdown', content: '\n\nEnd.' }
        ]);
    });

    await t.test('excerpt at the very beginning', () => {
        const text = 'excerpt_from_previous_claude_message.txt:\n\nPlain excerpt here\n\nFollow up text.';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'excerpt', content: 'Plain excerpt here' },
            { type: 'markdown', content: '\n\nFollow up text.' }
        ]);
    });

    await t.test('windows style line endings', () => {
        const text = 'Before\r\n\r\nexcerpt_from_previous_claude_message.txt:\r\n\r\n```js\r\nconsole.log();\r\n```\r\nAfter';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'markdown', content: 'Before\r\n\r\n' },
            { type: 'excerpt', content: 'console.log();' },
            { type: 'markdown', content: '\r\nAfter' }
        ]);
    });

    await t.test('adjacent excerpts', () => {
        const text = 'excerpt_from_previous_claude_message.txt:\n\nExcerpt 1\n\nexcerpt_from_previous_claude_message.txt:\n\nExcerpt 2';
        const result = splitTextOnExcerpts(text);
        assert.deepStrictEqual(result, [
            { type: 'excerpt', content: 'Excerpt 1' },
            { type: 'markdown', content: '\n\n' },
            { type: 'excerpt', content: 'Excerpt 2' }
        ]);
    });
});

test('transformExcerptBlocks', async (t) => {
    await t.test('transforms only excerpt blocks', () => {
        const text = 'Before\n\nexcerpt_from_previous_claude_message.txt:\n\nThis is excerpt\n\nAfter';
        const result = transformExcerptBlocks(text, (content) => `> ${content}`);
        assert.strictEqual(result, 'Before\n\n> This is excerpt\n\nAfter');
    });

    await t.test('handles text without excerpts', () => {
        const text = 'Just some text';
        const result = transformExcerptBlocks(text, () => 'should not be called');
        assert.strictEqual(result, text);
    });
});
