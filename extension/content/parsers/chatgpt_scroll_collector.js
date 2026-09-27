const TURN_SELECTOR = 'section[data-testid^="conversation-turn-"]';
const DEFAULT_RENDER_WAIT_MS = 140;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isScrollable(element) {
  if (!element) return false;
  return element.scrollHeight > element.clientHeight + 40;
}

function messageKey(message) {
  if (message.key) return message.key;
  return `${message.role}:${message.content.replace(/\s+/g, ' ').trim()}`;
}

function publicMessage(message) {
  return {
    role: message.role,
    content: message.content,
  };
}

export function getConversationTurnIndex(turn) {
  if (!turn) return Number.POSITIVE_INFINITY;
  const testId = turn.getAttribute?.('data-testid') || '';
  const match = testId.match(/^conversation-turn-(\d+)$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function getConversationTurns(doc = document) {
  if (!doc || !doc.querySelectorAll) return [];
  return Array.from(doc.querySelectorAll(TURN_SELECTOR)).sort((a, b) => {
    return getConversationTurnIndex(a) - getConversationTurnIndex(b);
  });
}

export function findChatGPTScrollRoot(turns = [], doc = document) {
  if (!doc) return null;

  // 1. ChatGPT modern explicit data-scroll-root
  const scrollRootAttr = doc.querySelector?.('[data-scroll-root]');
  if (scrollRootAttr && isScrollable(scrollRootAttr)) return scrollRootAttr;

  // 2. Class-based scroll root
  const groupScrollRoot = doc.querySelector?.('.group\\/scroll-root');
  if (groupScrollRoot && isScrollable(groupScrollRoot)) return groupScrollRoot;

  // 3. Ancestors of conversation turns
  const turnList = Array.isArray(turns) && turns.length > 0 ? turns : getConversationTurns(doc);
  const firstTurn = turnList.find(Boolean) || doc.querySelector?.(TURN_SELECTOR);
  let current = firstTurn?.parentElement || null;
  while (current) {
    if (isScrollable(current)) return current;
    current = current.parentElement;
  }

  // 4. Main element
  const main = doc.querySelector?.('main');
  if (isScrollable(main)) return main;

  return doc.scrollingElement || doc.documentElement || doc.body;
}

export async function collectMountedTurnMessages({
  turns = [],
  scrollRoot,
  extractMessage,
  waitForRender = delay,
  renderWaitMs = DEFAULT_RENDER_WAIT_MS,
  doc = typeof document !== 'undefined' ? document : null,
}) {
  const originalTop = scrollRoot?.scrollTop;
  const messagesMap = new Map();

  const scan = () => {
    if (!doc || !doc.querySelectorAll) return;

    // Scan turn containers
    const currentTurns =
      doc && doc.querySelectorAll ? getConversationTurns(doc) : (Array.isArray(turns) ? turns : []);
    currentTurns.forEach((turn) => {
      const idx = getConversationTurnIndex(turn);
      const msg = extractMessage(turn);
      if (msg && msg.content) {
        const key = messageKey(msg);
        if (!messagesMap.has(key)) {
          messagesMap.set(key, { index: idx, message: publicMessage(msg) });
        }
      }
    });

    // Also scan any [data-message-author-role] elements directly
    const roleEls = Array.from(doc.querySelectorAll('[data-message-author-role]') || []);
    roleEls.forEach((el, fallbackIdx) => {
      const msg = extractMessage(el);
      if (msg && msg.content) {
        const key = messageKey(msg);
        if (!messagesMap.has(key)) {
          const parentTurn = el.closest?.(TURN_SELECTOR);
          const idx = parentTurn ? getConversationTurnIndex(parentTurn) : (messagesMap.size || fallbackIdx);
          messagesMap.set(key, { index: idx, message: publicMessage(msg) });
        }
      }
    });
  };

  try {
    // Initial scan at current viewport
    scan();

    // Step-scroll down if scrollable
    if (scrollRoot && isScrollable(scrollRoot)) {
      scrollRoot.scrollTop = 0;
      await waitForRender(renderWaitMs);
      scan();

      const step = Math.max(300, Math.floor(scrollRoot.clientHeight * 0.75));
      let stalled = 0;

      while (scrollRoot.scrollTop < scrollRoot.scrollHeight - scrollRoot.clientHeight - 5 && stalled < 3) {
        const prevTop = scrollRoot.scrollTop;
        scrollRoot.scrollTop = Math.min(scrollRoot.scrollTop + step, scrollRoot.scrollHeight);
        await waitForRender(renderWaitMs);
        scan();

        if (scrollRoot.scrollTop === prevTop) {
          stalled += 1;
        } else {
          stalled = 0;
        }
      }

      // One final scan at the bottom
      scrollRoot.scrollTop = scrollRoot.scrollHeight;
      await waitForRender(renderWaitMs);
      scan();
    }

    // Scroll any remaining empty turn containers into view
    if (doc && doc.querySelectorAll) {
      const allTurns = getConversationTurns(doc);
      for (const turn of allTurns) {
        const msg = extractMessage(turn);
        if (!msg || !msg.content) {
          const target = turn.closest?.('[data-turn-id-container]') || turn;
          target.scrollIntoView?.({ block: 'center' });
          await waitForRender(renderWaitMs);
          scan();
        }
      }
    }
  } finally {
    if (scrollRoot && Number.isFinite(originalTop)) {
      scrollRoot.scrollTop = originalTop;
    }
  }

  return Array.from(messagesMap.values())
    .sort((a, b) => a.index - b.index)
    .map((item) => item.message);
}
