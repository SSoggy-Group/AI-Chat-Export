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



test("convertToMarkdown noise removal with DOM elements", async (t) => {
  const { convertToMarkdown } = await import("./content/utils/html-to-markdown.js");

  class MockDOMElement extends global.HTMLElement {
    constructor(tagName = "div", attributes = {}, textContent = "") {
      super();
      this.tagName = tagName.toUpperCase();
      this.attributes = { ...attributes };
      this.textContent = textContent;
      this.children = [];
      this.parentNode = null;
      this.ownerDocument = {
        createTextNode: (text) => new MockDOMElement("#text", {}, text),
      };
    }

    get parentElement() { return this.parentNode; }
    get firstElementChild() { return this.children[0] || null; }

    getAttribute(name) { return this.attributes[name] ?? null; }
    hasAttribute(name) { return name in this.attributes; }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    get classList() {
      const classes = (this.attributes.class || "").split(" ").filter(Boolean);
      return { contains: (c) => classes.includes(c) };
    }

    get innerHTML() {
      if (this.children.length > 0) {
        return this.children.map(c => c.outerHTML).join("");
      }
      return this.textContent;
    }

    get outerHTML() {
      if (this.tagName === "#TEXT") return this.textContent;
      const attrs = Object.entries(this.attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      const attrStr = attrs ? ` ${attrs}` : "";
      return `<${this.tagName.toLowerCase()}${attrStr}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
    }

    cloneNode(deep = true) {
      const clone = new MockDOMElement(this.tagName, { ...this.attributes }, this.textContent);
      if (deep) {
        this.children.forEach(c => clone.appendChild(c.cloneNode(true)));
      }
      return clone;
    }

    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) {
          this.parentNode.children.splice(idx, 1);
        }
        this.parentNode = null;
      }
    }

    closest(selector) {
      let curr = this;
      while (curr) {
        if (matchSelector(curr, selector)) return curr;
        curr = curr.parentNode;
      }
      return null;
    }

    querySelectorAll(selector) {
      const results = [];
      const search = (node) => {
        for (const child of node.children) {
          if (matchSelector(child, selector)) {
            results.push(child);
          }
          search(child);
        }
      };
      search(this);
      return results;
    }

    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    }
  }

  function matchSelector(el, selector) {
    if (!el || !el.tagName) return false;
    let parent = el.parentNode;
    let insideQwen = false;
    while (parent) {
      if (parent.classList && parent.classList.contains("qwen-markdown-code")) {
        insideQwen = true;
        break;
      }
      parent = parent.parentNode;
    }

    if (selector.endsWith(":not(.qwen-markdown-code *)")) {
      if (insideQwen) return false;
      const baseSelector = selector.replace(":not(.qwen-markdown-code *)", "").trim();
      return matchBase(el, baseSelector);
    }
    return matchBase(el, selector);
  }

  function matchBase(el, selector) {
    if (selector === "button") return el.tagName === "BUTTON";
    if (selector === "[role=\"button\"]") return el.getAttribute("role") === "button";
    if (selector === ".sr-only") return el.classList.contains("sr-only");
    if (selector === "svg") return el.tagName === "SVG";
    if (selector === "[aria-hidden=\"true\"]") return el.getAttribute("aria-hidden") === "true";
    if (selector === ".katex-display") return el.classList.contains("katex-display");
    if (selector === ".katex") return el.classList.contains("katex");
    if (selector === "[data-math]") return el.hasAttribute("data-math");
    if (selector === "[data-xpm-latex]") return el.hasAttribute("data-xpm-latex");
    if (selector === ".pHpOfb") return el.classList.contains("pHpOfb");
    if (selector === "pre") return el.tagName === "PRE";
    if (selector === "*") return true;
    return false;
  }

  await t.test("removes noise elements like button, svg, sr-only, and aria-hidden outside qwen code blocks", () => {
    const originalDOMParser = global.DOMParser;
    const originalConsoleError = console.error;
    console.error = () => {};
    global.DOMParser = class MockDOMParser {
      parseFromString(str) {
        return { body: { innerText: str, textContent: str } };
      }
    };

    try {
      const root = new MockDOMElement("div");
      const paragraph = new MockDOMElement("p", {}, "Content text");
      const button = new MockDOMElement("button", {}, "Copy");
      const srOnly = new MockDOMElement("span", { class: "sr-only" }, "Screen reader text");
      const svg = new MockDOMElement("svg", {}, "icon");
      const ariaHidden = new MockDOMElement("div", { "aria-hidden": "true" }, "hidden");

      root.appendChild(paragraph);
      root.appendChild(button);
      root.appendChild(srOnly);
      root.appendChild(svg);
      root.appendChild(ariaHidden);

      const result = convertToMarkdown(root);
      assert.strictEqual(result.includes("Content text"), true);
      assert.strictEqual(result.includes("Copy"), false);
      assert.strictEqual(result.includes("Screen reader text"), false);
      assert.strictEqual(result.includes("icon"), false);
      assert.strictEqual(result.includes("hidden"), false);
    } finally {
      global.DOMParser = originalDOMParser;
      console.error = originalConsoleError;
    }
  });

  await t.test("preserves elements inside qwen-markdown-code", () => {
    const originalDOMParser = global.DOMParser;
    const originalConsoleError = console.error;
    console.error = () => {};
    global.DOMParser = class MockDOMParser {
      parseFromString(str) {
        return { body: { innerText: str, textContent: str } };
      }
    };

    try {
      const root = new MockDOMElement("div");
      const qwenCode = new MockDOMElement("pre", { class: "qwen-markdown-code" });
      const line = new MockDOMElement("div", { class: "view-line" });
      const spanButton = new MockDOMElement("button", {}, "inside button");
      line.appendChild(spanButton);
      qwenCode.appendChild(line);
      root.appendChild(qwenCode);

      const result = convertToMarkdown(root);
      assert.strictEqual(result.includes("inside button"), true);
    } finally {
      global.DOMParser = originalDOMParser;
      console.error = originalConsoleError;
    }
  });
});
