import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiParser } from './content/parsers/gemini.js';

test('GeminiParser splitIntoSections splits text correctly', () => {
  const parser = new GeminiParser();

  const text = `Section 1 starts here with enough length to pass fifty characters limit easily.
Another line in section 1.

Section 2 is a second paragraph that is also quite long and detailed.
12345
Short

Final section 3 with comprehensive content about deep research results and analysis.`;

  const result = parser.splitIntoSections(text);

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length > 0, true);
  assert.equal(result.every((sec) => sec.length > 50 && !/^\d+$/.test(sec)), true);
});

test('GeminiParser splitIntoSections performance benchmark', () => {
  const parser = new GeminiParser();
  const paragraph = 'Deep Research Analysis on Global Economic Trends in 2025.\nThis comprehensive report evaluates the market projections, trade policies, and technological disruptions.\nKey Findings include rising AI adoption, shifting energy markets, and monetary policy adjustments.\n\n';
  const largeText = paragraph.repeat(1000);

  const start = performance.now();
  const iterations = 50;
  for (let i = 0; i < iterations; i++) {
    parser.splitIntoSections(largeText);
  }
  const duration = performance.now() - start;
  console.log(`[Benchmark] splitIntoSections ${iterations} iterations took ${duration.toFixed(2)} ms`);
});
