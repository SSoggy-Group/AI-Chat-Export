export const TURN_SELECTOR = 'section[data-testid^="conversation-turn-"]';
const DEFAULT_RENDER_WAIT_MS = 140;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks whether an element's content exceeds its viewport height by more than 40 pixels.
 * @param {Element|null|undefined} element - Candidate scroll container.
 * @returns {boolean}
 */
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

/**
 * Reads the numeric index from a conversation turn's data-testid attribute.
 * @param {Element|null|undefined} turn - Mounted conversation turn.
 * @returns {number} Turn index, or Infinity when the attribute is missing or invalid.
 */
export function getConversationTurnIndex(turn) {
  if (!turn) return Number.POSITIVE_INFINITY;
  const testId = turn.getAttribute?.('data-testid') || '';
  const match = testId.match(/^conversation-turn-(\d+)$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/**
 * Finds currently mounted conversation turns and sorts them by their numeric indices.
 * @param {Document|null} [doc=document] - Document to query.
 * @returns {Element[]} Sorted turns, or an empty array if querying is unavailable.
 */
export function getConversationTurns(doc = document) {
  if (!doc || !doc.querySelectorAll) return [];
  return Array.from(doc.querySelectorAll(TURN_SELECTOR)).sort((a, b) => {
    return getConversationTurnIndex(a) - getConversationTurnIndex(b);
  });
}

/**
 * Finds a scroll root using explicit markers, turn ancestors, then document fallbacks.
 * @param {Element[]} [turns=[]] - Mounted turns; an empty array triggers a document query.
 * @param {Document|null} [doc=document] - Document containing the conversation.
 * @returns {Element|null} Scroll container, or null when no document is supplied.
 */
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

/**
 * Scans live messages while scrolling, deduplicates them, and restores the original scroll position.
 * @param {Object} options - Collection dependencies and render timing.
 * @param {Element[]} [options.turns=[]] - Legacy turn list; scanning requires a queryable document.
 * @param {Element|null} options.scrollRoot - Container to scroll when its content overflows.
 * @param {function(Element): ({role: string, content: string, key?: string|Element}|null)} options.extractMessage - Reads a turn or role element.
 * @param {function(number): Promise<void>} [options.waitForRender] - Waits after scrolling; defaults to a timer.
 * @param {number} [options.renderWaitMs=140] - Delay in milliseconds between scrolling and scanning.
 * @param {Document|null} [options.doc] - Document to scan; defaults to the global document when available.
 * @returns {Promise<Array<{role: string, content: string}>>} Messages ordered by turn or fallback index.
 */
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

  /** Adds newly observed turn and role-element messages to the collection. */
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

    // Also scan standalone role elements not inside a turn container
    const standaloneRoleEls = Array.from(
      doc.querySelectorAll('[data-message-author-role]') || []
    ).filter((el) => !el.closest?.(TURN_SELECTOR));

    // Place standalone nodes between their neighboring turns on the same index scale.
    const mounted = [...currentTurns, ...standaloneRoleEls].sort((a, b) => {
      const position = a.compareDocumentPosition?.(b) || 0;
      return position & 4 ? -1 : position & 2 ? 1 : 0;
    });
    standaloneRoleEls.forEach((el) => {
      const msg = extractMessage(el);
      if (msg && msg.content) {
        const key = msg.key || el;
        if (!messagesMap.has(key)) {
          const position = mounted.indexOf(el);
          const previous = mounted.slice(0, position).findLast((node) => currentTurns.includes(node));
          const next = mounted.slice(position + 1).find((node) => currentTurns.includes(node));
          const start = previous ? mounted.indexOf(previous) : -1;
          const end = next ? mounted.indexOf(next) : mounted.length;
          const fraction = (position - start) / (end - start);
          const previousIndex = getConversationTurnIndex(previous);
          const nextIndex = getConversationTurnIndex(next);
          const index = Number.isFinite(previousIndex)
            ? previousIndex + fraction * (Number.isFinite(nextIndex) ? nextIndex - previousIndex : 1)
            : Number.isFinite(nextIndex) ? nextIndex - 1 + fraction : messagesMap.size;
          messagesMap.set(key, { index, message: publicMessage(msg) });
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
