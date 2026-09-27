import { ChatParser } from './base.js';
import { convertToMarkdown } from '../utils/html-to-markdown.js';

export class DeepSeekParser extends ChatParser {
  isAvailable(url) {
    return url.includes('chat.deepseek.com');
  }

  /**
   * Collects messages and optional assistant thoughts across virtualized scroll steps.
   * Restores the original scroll position and orders messages by virtual-list or fallback index.
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string, thinking?: string}>}>}
   */
  async parse() {
    const title = document.title || 'DeepSeek Chat';
    const messagesMap = new Map();

    /** Adds unseen mounted messages, using legacy selectors when no message containers exist. */
    const scanMessages = () => {
      // 1. Primary: .ds-message containers or virtual list items
      const messageContainers = Array.from(
        document.querySelectorAll(
          '.ds-message, [class*="ds-message"], [data-virtual-list-item-key], .ds-message-row, .message-row',
        ),
      );

      if (messageContainers.length > 0) {
        messageContainers.forEach((container, idx) => {
          const isAssistant = Boolean(
            container.querySelector('.ds-markdown, [class*="ds-markdown"], [class*="assistant-message"]') ||
            container.classList.contains('ds-assistant-message'),
          );

          const role = isAssistant ? 'DeepSeek' : 'User';
          let content = '';
          let thinking = '';

          if (isAssistant) {
            const thoughtEl = container.querySelector('.ds-thought, [class*="thought"]');
            if (thoughtEl) {
              thinking = convertToMarkdown(thoughtEl).trim();
            }

            const mdEl =
              container.querySelector(
                '.ds-markdown, [class*="ds-markdown"], [class*="assistant-message-main-content"]',
              ) || container;
            const clone = mdEl.cloneNode(true);
            if (thoughtEl) {
              clone.querySelectorAll('.ds-thought, [class*="thought"]').forEach((el) => el.remove());
            }
            clone.querySelectorAll('button, svg, [class*="icon"], [class*="action"]').forEach((el) => el.remove());
            content = convertToMarkdown(clone).trim();
          } else {
            const clone = container.cloneNode(true);
            clone.querySelectorAll('button, svg, [class*="icon"], [class*="action"]').forEach((el) => el.remove());
            content = convertToMarkdown(clone).trim();
          }

          if (content) {
            const vKey = container.getAttribute('data-virtual-list-item-key');
            const key = vKey ? `vkey-${vKey}` : `${role}:${content}`;
            if (!messagesMap.has(key)) {
              const sortIndex = vKey !== null && !isNaN(Number(vKey)) ? Number(vKey) : (messagesMap.size || idx);
              messagesMap.set(key, { index: sortIndex, role, content, ...(thinking ? { thinking } : {}) });
            }
          }
        });
      } else {
        // 2. Fallback to candidate selectors if no message containers found
        const userSelector = '.fbb737a4';
        const assistantSelector = '.ds-markdown';
        const allElements = Array.from(document.querySelectorAll(`${userSelector}, ${assistantSelector}`));

        allElements.forEach((el, idx) => {
          const role = el.matches(userSelector) ? 'User' : 'DeepSeek';
          const clone = el.cloneNode(true);
          clone.querySelectorAll('button, svg').forEach((b) => b.remove());
          const text = convertToMarkdown(clone).trim();
          if (text) {
            const key = `${role}:${text}`;
            if (!messagesMap.has(key)) {
              messagesMap.set(key, { index: idx, role, content: text });
            }
          }
        });
      }
    };

    // Step-scroll to handle virtualization
    const scrollCandidates = [
      document.querySelector('.ds-virtual-list'),
      document.querySelector('div[class*="virtual-list"]'),
      document.querySelector('main .overflow-y-auto'),
      document.querySelector('.overflow-y-auto'),
      document.querySelector('main'),
      document.scrollingElement,
    ];
    const scrollContainer =
      scrollCandidates.find((candidate) => candidate && candidate.scrollHeight > candidate.clientHeight + 60) ||
      scrollCandidates.find(Boolean);

    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 60) {
      const origTop = scrollContainer.scrollTop;
      try {
        scrollContainer.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 140));
        scanMessages();

        const step = Math.max(300, Math.floor(scrollContainer.clientHeight * 0.75));
        let stalled = 0;
        while (
          scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight - 10 &&
          stalled < 3
        ) {
          const before = scrollContainer.scrollTop;
          scrollContainer.scrollTop = Math.min(scrollContainer.scrollTop + step, scrollContainer.scrollHeight);
          await new Promise((r) => setTimeout(r, 120));
          scanMessages();

          if (scrollContainer.scrollTop === before) {
            stalled++;
          } else {
            stalled = 0;
          }
        }

        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        await new Promise((r) => setTimeout(r, 120));
        scanMessages();
      } finally {
        scrollContainer.scrollTop = origTop;
      }
    } else {
      scanMessages();
    }

    const messages = Array.from(messagesMap.values())
      .sort((a, b) => a.index - b.index)
      .map(({ role, content, thinking }) => ({
        role,
        content,
        ...(thinking ? { thinking } : {}),
      }));

    return { title, messages };
  }
}
