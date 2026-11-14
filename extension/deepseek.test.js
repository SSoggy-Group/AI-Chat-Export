import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekParser } from './content/parsers/deepseek.js';

test('DeepSeekParser.isAvailable', () => {
  const parser = new DeepSeekParser();
  assert.equal(parser.isAvailable('https://chat.deepseek.com/'), true);
  assert.equal(parser.isAvailable('https://chat.deepseek.com/coder'), true);
  assert.equal(parser.isAvailable('https://claude.ai/'), false);
});

test('DeepSeekParser candidate filtering benchmark', () => {
  function createMockElem(className) {
    const children = [];
    const el = {
      className,
      parentElement: null,
      children,
      appendChild: (child) => {
        child.parentElement = el;
        children.push(child);
        return child;
      },
      matches: (sel) => sel === '.ds-message' && el.className.includes('ds-message'),
      contains: (other) => {
        if (el === other) return true;
        let curr = other ? other.parentElement : null;
        while (curr) {
          if (curr === el) return true;
          curr = curr.parentElement;
        }
        return false;
      },
    };
    return el;
  }

  const numMessages = 100;
  const descendantsPerMessage = 20;
  const rawContainers = [];

  const root = createMockElem('root');

  for (let i = 0; i < numMessages; i++) {
    const msgRow = createMockElem('ds-message-row');
    rawContainers.push(msgRow);
    root.appendChild(msgRow);

    const msg = createMockElem('ds-message' + (i % 2 === 1 ? ' ds-assistant-message' : ''));
    rawContainers.push(msg);
    msgRow.appendChild(msg);

    const md = createMockElem(i % 2 === 1 ? 'ds-markdown' : 'user-content');
    rawContainers.push(md);
    msg.appendChild(md);

    for (let j = 0; j < descendantsPerMessage; j++) {
      const child = createMockElem('message-row child-elem');
      rawContainers.push(child);
      md.appendChild(child);
    }
  }

  const iterations = 500;

  // Optimized logic (as implemented in DeepSeekParser)
  const start = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    const messageRootsSet = new Set();
    for (let i = 0; i < rawContainers.length; i++) {
      const el = rawContainers[i];
      if (el.matches('.ds-message')) {
        messageRootsSet.add(el);
      }
    }

    const candidates = [];
    for (let i = 0; i < rawContainers.length; i++) {
      const el = rawContainers[i];
      if (messageRootsSet.has(el)) {
        candidates.push(el);
      } else {
        let isInsideRoot = false;
        let curr = el.parentElement;
        while (curr) {
          if (messageRootsSet.has(curr)) {
            isInsideRoot = true;
            break;
          }
          curr = curr.parentElement;
        }
        if (!isInsideRoot) {
          candidates.push(el);
        }
      }
    }
  }
  const duration = performance.now() - start;
  console.log(`[Benchmark] Optimized candidate filtering ${iterations} iterations took ${duration.toFixed(2)} ms`);
});
