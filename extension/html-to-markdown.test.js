const test = require('node:test');
const assert = require('node:assert');

test('cleanMarkdown', async (t) => {
  const { cleanMarkdown } = await import('./content/utils/html-to-markdown.js');

  await t.test('trims leading and trailing whitespace', () => {
    const input = '   \n\nHello world\n\n   ';
    const expected = 'Hello world';
    assert.strictEqual(cleanMarkdown(input), expected);
  });

  await t.test('collapses 3 or more consecutive newlines into 2 newlines', () => {
    const input = 'Paragraph 1\n\n\n\nParagraph 2\n\n\nParagraph 3';
    const expected = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
    assert.strictEqual(cleanMarkdown(input), expected);
  });

  await t.test('removes trailing spaces and tabs from lines', () => {
    const input = 'Line with trailing spaces   \nLine with trailing tabs\t\t\n  Indented line with trailing spaces  ';
    const expected = 'Line with trailing spaces\nLine with trailing tabs\n  Indented line with trailing spaces';
    assert.strictEqual(cleanMarkdown(input), expected);
  });

  await t.test('normalizes horizontal rules', () => {
    const hr3Dashes = '---';
    const hr5Dashes = '-----';
    const hr3Asterisks = '***';
    const hr3Underscores = '___';

    assert.strictEqual(cleanMarkdown(hr3Dashes), '* * *');
    assert.strictEqual(cleanMarkdown(hr5Dashes), '* * *');
    assert.strictEqual(cleanMarkdown(hr3Asterisks), '* * *');
    assert.strictEqual(cleanMarkdown(hr3Underscores), '* * *');
  });

  await t.test('handles combination of markdown artifacts', () => {
    const input = 'Header  \n\n\n\n---\n\n\nSome text with spaces \t \n___\n\nEnd  ';
    const expected = 'Header\n\n* * *\n\nSome text with spaces\n* * *\n\nEnd';
    assert.strictEqual(cleanMarkdown(input), expected);
  });

  await t.test('handles empty or whitespace-only strings', () => {
    assert.strictEqual(cleanMarkdown(''), '');
    assert.strictEqual(cleanMarkdown('   \n\t  '), '');
  });
});

test("TurndownService nodeValue handling", async (t) => {
  const TurndownService = (await import("./content/lib/turndown.js")).default;
  const ts = new TurndownService();

  await t.test("handles text node with null nodeValue without throwing error", () => {
    const mockTextNode = {
      nodeType: 3,
      nodeValue: null,
      textContent: "",
      childNodes: [],
      parentNode: { isCode: false }
    };
    const mockParent = {
      nodeType: 1,
      nodeName: "DIV",
      childNodes: [mockTextNode],
      cloneNode: function () { return this; },
      getElementsByTagName: function () { return []; }
    };

    assert.doesNotThrow(() => {
      const result = ts.turndown(mockParent);
      assert.strictEqual(typeof result, "string");
    });
  });

  await t.test("handles code text node with null nodeValue without throwing error", () => {
    const mockCodeTextNode = {
      nodeType: 3,
      nodeValue: null,
      textContent: "",
      childNodes: [],
      parentNode: { nodeName: "CODE", isCode: true }
    };
    const mockCodeParent = {
      nodeType: 1,
      nodeName: "CODE",
      childNodes: [mockCodeTextNode],
      cloneNode: function () { return this; },
      getElementsByTagName: function () { return []; }
    };

    assert.doesNotThrow(() => {
      const result = ts.turndown(mockCodeParent);
      assert.strictEqual(typeof result, "string");
    });
  });
});
