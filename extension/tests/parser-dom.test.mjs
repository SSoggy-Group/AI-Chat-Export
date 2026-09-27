// Browser regression suite. Serve the repo and call runParserDOMTests() from a
// page importing this module; no extension or authenticated provider is needed.
import { ChatGPTParser } from '../content/parsers/chatgpt.js';
import { collectMountedTurnMessages } from '../content/parsers/chatgpt_scroll_collector.js';
import { ClaudeParser } from '../content/parsers/claude.js';
import { DeepSeekParser } from '../content/parsers/deepseek.js';

/**
 * Compares test values by their JSON serialization, including array and object key order.
 * @param {*} actual - Observed value.
 * @param {*} expected - Expected value.
 * @returns {void}
 * @throws {Error} When the serialized values differ.
 */
function equal(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

/**
 * Runs parser regressions in a browser document using synthetic messages and artifact responses.
 * Restores replaced browser globals and removes fixtures after the test cases finish.
 * @returns {Promise<Array<{name: string, status: string, error?: string}>>} Per-case pass or failure results.
 */
export async function runParserDOMTests() {
  const results = [];
  const fixture = document.createElement('div');
  document.body.append(fixture);
  const readerMarker = document.createElement('script');
  readerMarker.id = 'ai-export-claude-reader';
  document.head.append(readerMarker);
  const originalTimeout = window.setTimeout;
  const originalPostMessage = window.postMessage;
  let onWait = () => {};
  // Drive scroll rendering deterministically without waiting on wall-clock timers.
  window.setTimeout = (callback, ms, ...args) => {
    if (ms === 120 || ms === 140) {
      queueMicrotask(() => { onWait(); callback(...args); });
      return 0;
    }
    return originalTimeout(callback, ms, ...args);
  };
  const artifactRequests = [];
  window.postMessage = (data) => {
    if (data.type !== 'ReqAtftInfo') return;
    artifactRequests.push(data.idx);
    window.dispatchEvent(new MessageEvent('message', { data: {
      type: 'RspAtftInfo', idx: data.idx,
      atftInfo: { title: `Artifact ${data.idx}`, content: `Body ${data.idx}`, language: 'text' },
    } }));
  };
  const test = async (name, run) => {
    fixture.innerHTML = '';
    onWait = () => {};
    artifactRequests.length = 0;
    try {
      await run();
      results.push({ name, status: 'passed' });
    } catch (error) {
      results.push({ name, status: 'failed', error: error.message });
    }
  };
  const scrollable = () => {
    const main = fixture.querySelector('main');
    let top = 75;
    Object.defineProperties(main, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 400 },
      scrollTop: { get: () => top, set: (value) => { top = Math.min(600, value); } },
    });
    return main;
  };
  const chatgpt = (options = {}) => {
    const parser = new ChatGPTParser();
    return collectMountedTurnMessages({
      doc: document, extractMessage: (el) => parser.extractMessage(el), ...options,
    });
  };
  const role = (content, author = 'user', attributes = '') =>
    `<div data-message-author-role="${author}" ${attributes}>${content}</div>`;
  const turn = (index, content) =>
    `<section data-testid="conversation-turn-${index}">${role(content)}</section>`;

  try {
    await test('ChatGPT preserves repeated prompts and replies without IDs across scans', async () => {
      fixture.innerHTML = `<main>${role('Again')}${role('OK', 'assistant')}${role('Again')}${role('OK', 'assistant')}</main>`;
      const root = scrollable();
      equal(await chatgpt({ scrollRoot: root, waitForRender: async () => {} }), [
        { role: 'User', content: 'Again' }, { role: 'ChatGPT', content: 'OK' },
        { role: 'User', content: 'Again' }, { role: 'ChatGPT', content: 'OK' },
      ]);
      equal(root.scrollTop, 75);
    });

    await test('ChatGPT deduplicates remounted stable message and virtual-item IDs', async () => {
      const content = role('Same', 'user', 'data-message-id="id-1"') +
        role('Same', 'user', 'data-message-id="id-2"') +
        `<div data-item-index="0">${role('Same')}${role('Same')}</div>` +
        `<div data-index="1">${role('Same')}</div>` +
        `<div data-virtual-list-item-key="two">${role('Same')}</div>`;
      fixture.innerHTML = `<main>${content}</main>`;
      const root = scrollable();
      const messages = await chatgpt({ scrollRoot: root, waitForRender: async () => { root.innerHTML = content; } });
      equal(messages.length, 6);
      equal(messages.every((message) => message.content === 'Same'), true);
    });

    await test('ChatGPT orders standalone nodes before, between and after high-index turns', async () => {
      fixture.innerHTML = role('Before') + turn(40, 'Forty') + role('Middle 1') +
        role('Middle 2') + turn(42, 'Forty-two') + role('After');
      equal((await chatgpt()).map((message) => message.content),
        ['Before', 'Forty', 'Middle 1', 'Middle 2', 'Forty-two', 'After']);
    });

    await test('ChatGPT orders mixed messages across remounted scroll windows', async () => {
      fixture.innerHTML = `<main>${turn(40, 'Forty')}${role('After', 'user', 'data-message-id="after"')}</main>`;
      const root = scrollable();
      const messages = await chatgpt({ scrollRoot: root, waitForRender: async () => {
        root.innerHTML = root.scrollTop === 0 ? turn(1, 'First') :
          turn(40, 'Forty') + role('After', 'user', 'data-message-id="after"');
      } });
      equal(messages.map((message) => message.content), ['First', 'Forty', 'After']);
    });

    await test('Claude retains nested artifacts and multiple candidates per indexed item after remount', async () => {
      const content = `<div data-item-index="0"><div class="font-claude-response">Answer
        <div class="artifact-block-cell">Card one</div>
        <div class="artifact-block-cell">Card two</div></div>
        <div class="font-claude-response">Continuation</div></div>`;
      fixture.innerHTML = `<main>${content}</main>`;
      const root = scrollable();
      onWait = () => { root.innerHTML = content; };
      equal((await new ClaudeParser().parseFromDOM()).messages, [
        { role: 'Claude', content: 'Answer' },
        { role: 'Claude Artifact', content: '> **Artifact: Artifact 0**\n\n> Body 0' },
        { role: 'Claude Artifact', content: '> **Artifact: Artifact 1**\n\n> Body 1' },
        { role: 'Claude', content: 'Continuation' },
      ]);
      equal([...new Set(artifactRequests)], [0, 1]);
      equal(root.scrollTop, 75);
      equal(root.querySelectorAll('.artifact-block-cell').length, 2);
    });

    for (const indexed of [false, true]) {
      await test(`Claude refreshes streaming content (${indexed ? 'indexed' : 'unindexed'})`, async () => {
        fixture.innerHTML = `<main><div ${indexed ? 'data-index="0"' : ''}>
          <div class="font-claude-response"><div data-is-streaming="true">Partial</div></div>
          </div></main>`;
        const root = scrollable();
        let waits = 0;
        onWait = () => {
          if (++waits === 2) {
            const stream = root.querySelector('[data-is-streaming]');
            stream.textContent = 'Complete answer';
            stream.removeAttribute('data-is-streaming');
          }
        };
        equal((await new ClaudeParser().parseFromDOM()).messages,
          [{ role: 'Claude', content: 'Complete answer' }]);
        equal(root.scrollTop, 75);
      });
    }

    await test('DeepSeek keeps message roots with nested toolbar matches and thinking', async () => {
      fixture.innerHTML = `<main><div data-virtual-list-item-key="0"><div class="ds-message-row">
        <div class="ds-message">Question<div class="ds-message-toolbar"><button>Copy</button></div></div>
        </div></div><div data-virtual-list-item-key="1"><div class="ds-message ds-assistant-message">
        <div class="ds-thought">Reasoning</div><div class="ds-markdown"><p>Complete answer</p></div>
        <div class="ds-message-toolbar"><button>Copy</button><button>Retry</button></div>
        </div></div></main>`;
      const root = scrollable();
      equal((await new DeepSeekParser().parse()).messages, [
        { role: 'User', content: 'Question' },
        { role: 'DeepSeek', content: 'Complete answer', thinking: 'Reasoning' },
      ]);
      equal(root.scrollTop, 75);
    });
  } finally {
    window.setTimeout = originalTimeout;
    window.postMessage = originalPostMessage;
    readerMarker.remove();
    fixture.remove();
  }
  return results;
}
