const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const code = fs.readFileSync('./extension/content.js', 'utf8');

const sandbox = {
    window: { location: { href: 'https://claude.ai/chat/123' } },
    document: {
        createElement: () => ({ appendChild: () => {}, click: () => {}, classList: { add: () => {}, remove: () => {} } }),
        body: { appendChild: () => {}, removeChild: () => {} },
        head: { appendChild: () => {} },
        readyState: 'complete',
        querySelector: () => null,
        addEventListener: () => {}
    },
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    Blob: class Blob {},
    getComputedStyle: () => ({ backgroundColor: 'rgb(255, 255, 255)' }),
    MutationObserver: class MutationObserver { observe() {} },
    fetch: async () => ({ ok: true, json: async () => [] }),
    console: { error: () => {} },
    navigator: { clipboard: { writeText: () => {} } },
    setTimeout: () => {},
    clearTimeout: () => {},
    alert: () => {}
};

const wrapCode = `
    ${code}

    module.exports = {
        formatArtifactOutput: typeof formatArtifactOutput !== 'undefined' ? formatArtifactOutput : null
    };
`;

const vm = require('vm');
const script = new vm.Script(wrapCode);
const context = vm.createContext({ ...sandbox, module: {} });
script.runInContext(context);
const contentExports = context.module.exports;


test('formatArtifactOutput', async (t) => {
    const { formatArtifactOutput } = contentExports;

    await t.test('formats with props and content', () => {
        const props = 'identifier="test-id" type="application/vnd.ant.code" title="Test" language="javascript"';
        const content = 'console.log("hello");';
        const result = formatArtifactOutput(props, content);
        assert.strictEqual(
            result,
            '\n<antArtifact identifier="test-id" type="application/vnd.ant.code" title="Test" language="javascript">\nconsole.log("hello");\n</antArtifact>\n'
        );
    });

    await t.test('handles empty content', () => {
        const props = 'identifier="empty"';
        const result = formatArtifactOutput(props, '');
        assert.strictEqual(
            result,
            '\n<antArtifact identifier="empty">\n\n</antArtifact>\n'
        );
    });

    await t.test('handles empty props', () => {
        const content = 'something';
        const result = formatArtifactOutput('', content);
        assert.strictEqual(
            result,
            '\n<antArtifact >\nsomething\n</antArtifact>\n'
        );
    });
});
