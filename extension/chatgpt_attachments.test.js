const test = require("node:test");
const assert = require("node:assert");

test("ChatGPTParser extractAttachments", async (t) => {
  const { ChatGPTParser } = await import("./content/parsers/chatgpt.js");
  const parser = new ChatGPTParser();

  await t.test("returns empty array when container has no text content", () => {
    const container = { textContent: "" };
    const result = parser.extractAttachments(container);
    assert.deepStrictEqual(result, []);
  });

  await t.test("returns empty array when text content has no file attachments", () => {
    const container = { textContent: "Just a regular message without attachments." };
    const result = parser.extractAttachments(container);
    assert.deepStrictEqual(result, []);
  });

  await t.test("extracts various file attachment types and deduplicates matches", () => {
    const container = {
      textContent: `
        Here are the files:
        - report.pdf
        - notes.txt
        - README.md
        - paper.tex
        - doc1.doc
        - doc2.docx
        - report.pdf (duplicate)
        - UPPER.PDF
      `
    };
    const result = parser.extractAttachments(container);
    assert.deepStrictEqual(result, [
      { name: "report.pdf", type: "PDF" },
      { name: "notes.txt", type: "Text" },
      { name: "README.md", type: "Markdown" },
      { name: "paper.tex", type: "LaTeX" },
      { name: "doc1.doc", type: "Document" },
      { name: "doc2.docx", type: "Document" },
      { name: "UPPER.PDF", type: "PDF" },
    ]);
  });
});
