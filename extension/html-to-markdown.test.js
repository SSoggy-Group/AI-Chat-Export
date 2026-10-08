const test = require('node:test');
const assert = require('node:assert');

// Mock browser globals if not present before importing modules
if (typeof global.HTMLElement === 'undefined') {
  global.HTMLElement = class HTMLElement {};
}

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

test('convertToMarkdown error handling and edge cases', async (t) => {
  const { convertToMarkdown } = await import('./content/utils/html-to-markdown.js');

  await t.test('returns empty string and logs warning for invalid input types', () => {
    const originalWarn = console.warn;
    let warnLogged = false;
    console.warn = (...args) => {
      warnLogged = true;
    };

    try {
      assert.strictEqual(convertToMarkdown(null), '');
      assert.strictEqual(warnLogged, true);

      warnLogged = false;
      assert.strictEqual(convertToMarkdown(12345), '');
      assert.strictEqual(warnLogged, true);

      warnLogged = false;
      assert.strictEqual(convertToMarkdown({}), '');
      assert.strictEqual(warnLogged, true);
    } finally {
      console.warn = originalWarn;
    }
  });

  await t.test('falls back to DOMParser plain text when turndown conversion throws (innerText)', () => {
    const originalError = console.error;
    const originalDOMParser = global.DOMParser;
    let errorLogged = false;

    console.error = (...args) => {
      errorLogged = true;
    };

    global.DOMParser = class MockDOMParser {
      parseFromString(htmlString, mimeType) {
        return {
          body: {
            innerText: 'Fallback innerText content',
            textContent: 'Fallback textContent content'
          }
        };
      }
    };

    try {
      // Passing an object with invalid html type to turndown (or string that triggers error when turndown runs without document)
      // Standard string input where turndown throws due to missing browser document context in node
      const result = convertToMarkdown('<p>Some HTML</p>');
      assert.strictEqual(result, 'Fallback innerText content');
      assert.strictEqual(errorLogged, true);
    } finally {
      console.error = originalError;
      global.DOMParser = originalDOMParser;
    }
  });

  await t.test('falls back to DOMParser textContent when innerText is undefined/empty', () => {
    const originalError = console.error;
    const originalDOMParser = global.DOMParser;

    console.error = () => {};

    global.DOMParser = class MockDOMParser {
      parseFromString(htmlString, mimeType) {
        return {
          body: {
            innerText: undefined,
            textContent: 'Fallback textContent content'
          }
        };
      }
    };

    try {
      const result = convertToMarkdown('<p>Some HTML</p>');
      assert.strictEqual(result, 'Fallback textContent content');
    } finally {
      console.error = originalError;
      global.DOMParser = originalDOMParser;
    }
  });

  await t.test('falls back to empty string when both innerText and textContent are missing', () => {
    const originalError = console.error;
    const originalDOMParser = global.DOMParser;

    console.error = () => {};

    global.DOMParser = class MockDOMParser {
      parseFromString(htmlString, mimeType) {
        return {
          body: {}
        };
      }
    };

    try {
      const result = convertToMarkdown('<p>Some HTML</p>');
      assert.strictEqual(result, '');
    } finally {
      console.error = originalError;
      global.DOMParser = originalDOMParser;
    }
  });
});
