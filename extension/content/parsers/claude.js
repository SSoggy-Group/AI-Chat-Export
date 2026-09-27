import { ChatParser } from './base.js';
import { convertToMarkdown } from '../utils/html-to-markdown.js';

const CLAUDE_API_URL = 'https://claude.ai/api/organizations';

/**
 * Formats extracted attachment text and file names as Markdown without reading blob contents.
 * @param {Object} [options={}] - Attachment data from a user message.
 * @param {Array<{file_type?: string, file_name?: string, extracted_content?: string}>} [options.attachments] - Extracted attachments.
 * @param {Array<{file_name?: string}>} [options.files] - Files represented by name only.
 * @returns {string} Combined attachment and file descriptions.
 */
function processAttachments({ attachments, files } = {}) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const safeFiles = Array.isArray(files) ? files : [];

  const formatAttachment = ({ file_type, file_name, extracted_content }) => {
    const fileType = file_type?.split('/')[1] || file_type;
    const content = fileType
      ? `\`\`\`${fileType}\n${extracted_content}\n\`\`\``
      : extracted_content;
    return `\n\n${file_name}:\n\n${content}`;
  };

  const formatFile = ({ file_name }) =>
    file_name ? `\n\n${file_name} (can't show blob content)\n\n` : '';

  return (
    safeAttachments.map(formatAttachment).join('') + safeFiles.map(formatFile).join('')
  );
}

/**
 * Converts a Claude content block into text, including artifact and REPL tool inputs.
 * @param {{type: string, text?: string, name?: string, input?: Object}} item - API content block.
 * @returns {string} Markdown content, or an empty string for unsupported tool uses.
 */
function processContentItem(item) {
  switch (item.type) {
    case 'text':
      return item.text || '';
    case 'tool_use':
      if (item.name === 'artifacts') {
        const { id, type, language, content, title } = item.input || {};
        if (content) {
          const lang = language || type || '';
          return `\n\n> **Artifact: ${title || id}**\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
        }
      } else if (item.name === 'repl') {
        const code = item.input?.code || '';
        return code ? `\n\`\`\`javascript\n${code}\n\`\`\`\n` : '';
      }
      return '';
    default:
      return item.text || '';
  }
}

/**
 * Normalizes an API message, separating thinking and appending user attachments.
 * @param {{sender: string, content: string|Object[], attachments?: Object[], files_v2?: Object[]}} msg - Claude API message.
 * @returns {{role: string, content: string, thinking?: string}} Exportable message.
 */
function processApiMessage(msg) {
  const { sender, content, attachments, files_v2 } = msg;
  let message = '';
  let thinking = '';

  if (Array.isArray(content)) {
    const textParts = [];
    content.forEach((item) => {
      if (item.type === 'thinking') {
        thinking = (thinking ? thinking + '\n\n' : '') + (item.thinking || '');
      } else {
        const text = processContentItem(item);
        if (text) textParts.push(text);
      }
    });
    message = textParts.join('');
  } else if (typeof content === 'string') {
    message = content;
  }

  if (sender === 'human' || sender === 'user') {
    message += processAttachments({ attachments, files: files_v2 });
  }

  const role = (sender === 'human' || sender === 'user') ? 'User' : 'Claude';
  return {
    role,
    content: message.trim(),
    ...(thinking ? { thinking: thinking.trim() } : {}),
  };
}

export class ClaudeParser extends ChatParser {
  isAvailable(url) {
    return url.includes('claude.ai');
  }

  /**
   * Fetches the current conversation using the signed-in user's organization and session.
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string, thinking?: string}>, metadata: Record<string, string>}|null>}
   *   Conversation data, or null for missing identifiers, unsuccessful responses, or missing messages.
   * @throws {Error} Propagates network and JSON parsing failures for the caller to handle.
   */
  async parseFromAPI() {
    const convMatch = window.location.href.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    const convId = convMatch ? convMatch[1] : null;
    if (!convId) return null;

    // Get Organization ID with timeout
    const orgRes = await fetch(CLAUDE_API_URL, {
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!orgRes.ok) return null;

    const orgs = await orgRes.json();
    if (!Array.isArray(orgs) || orgs.length === 0) return null;

    const chatOrg = orgs.find((org) => org.capabilities?.includes('chat')) || orgs[0];
    const orgId = chatOrg?.uuid;
    if (!orgId) return null;

    // Fetch conversation details with timeout
    const convRes = await fetch(
      `${CLAUDE_API_URL}/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true`,
      {
        credentials: 'include',
        headers: { accept: '*/*', 'content-type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!convRes.ok) return null;

    const data = await convRes.json();
    if (!data || !Array.isArray(data.chat_messages) || data.chat_messages.length === 0) {
      return null;
    }

    const title = data.name || document.title || 'Claude Chat';
    const messages = data.chat_messages.map(processApiMessage).filter((m) => m.content);

    return {
      title,
      messages,
      metadata: {
        Source: 'Claude',
        Date: new Date().toLocaleString(),
        Link: window.location.href,
        Model: data.model || 'Claude',
      },
    };
  }

  /**
   * Collects mounted messages and artifacts while scrolling, then restores the scroll position.
   * Deduplicates repeated scans by role and content and retains first-seen order.
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string}>, metadata: Record<string, string>}>}
   */
  async parseFromDOM() {
    const title = document.title || 'Claude Chat';

    // Inject the React reader script if not already injected
    if (!document.getElementById('ai-export-claude-reader')) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/claude_react_reader.js');
      script.id = 'ai-export-claude-reader';
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
      await new Promise((r) => setTimeout(r, 100));
    }

    // Helper to get artifact info
    const getArtifactInfo = (index) => {
      return new Promise((resolve) => {
        const handler = (event) => {
          if (event.data.type === 'RspAtftInfo' && event.data.idx === index) {
            window.removeEventListener('message', handler);
            resolve(event.data.atftInfo);
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'ReqAtftInfo', idx: index }, window.location.origin);

        setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve(null);
        }, 1000);
      });
    };

    const messages = [];
    const seenNodes = new Set();
    const seenItemIndices = new Set();

    const strictSelectors = [
      '[data-testid="user-message"]',
      '.font-claude-message',
      '.font-claude-response',
      '.artifact-block-cell',
      '.standard-markdown',
      '[data-is-streaming]',
    ].join(', ');

    const fallbackSelectors = ['div.font-serif', 'div[class*="font-claude"]'].join(', ');

    /** Converts mounted message and artifact candidates and adds unseen role/content pairs. */
    const scan = async () => {
      const rawStrict = Array.from(document.querySelectorAll(strictSelectors));
      const strictCandidates = rawStrict.filter(
        (el) => !rawStrict.some((other) => other !== el && other.contains(el)),
      );

      const rawFallback = Array.from(document.querySelectorAll(fallbackSelectors));
      const fallbackCandidates = rawFallback.filter(
        (el) => !rawFallback.some((other) => other !== el && other.contains(el)),
      );

      const validFallbacks = fallbackCandidates.filter((fallback) => {
        const overlaps = strictCandidates.some(
          (strict) => strict.contains(fallback) || fallback.contains(strict),
        );
        return !overlaps;
      });

      const combined = [...new Set([...strictCandidates, ...validFallbacks])];
      const allElements = combined.sort((a, b) => {
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      const artifactElements = Array.from(document.querySelectorAll('.artifact-block-cell'));
      const artifactMap = new Map();
      artifactElements.forEach((el, index) => artifactMap.set(el, index));

      for (const el of allElements) {
        if (seenNodes.has(el)) continue;

        const virtuosoItem = el.closest?.('[data-item-index], [data-index]');
        const itemIdx = virtuosoItem?.getAttribute?.('data-item-index') || virtuosoItem?.getAttribute?.('data-index');
        if (itemIdx !== undefined && itemIdx !== null) {
          const roleHint = el.matches?.('[data-testid="user-message"]') ? 'user' : 'bot';
          const itemKey = `${itemIdx}:${roleHint}`;
          if (seenItemIndices.has(itemKey)) continue;
          seenItemIndices.add(itemKey);
        }

        seenNodes.add(el);

        let role = 'Unknown';
        let content = '';

        if (el.matches('[data-testid="user-message"]') || el.closest('[data-testid="user-message"]')) {
          role = 'User';
          const clone = el.cloneNode(true);
          clone.querySelectorAll('button').forEach((btn) => btn.remove());
          content = convertToMarkdown(clone);
        } else if (el.matches('.artifact-block-cell')) {
          role = 'Claude Artifact';
          const index = artifactMap.get(el);
          if (index !== undefined) {
            const info = await getArtifactInfo(index);
            if (info) {
              const artTitle = info.title || 'Artifact';
              const artContent = info.content || '';
              const artLang = info.language || 'text';
              if (artLang === 'markdown' || artLang === 'text') {
                const quotedContent = artContent
                  .split('\n')
                  .map((line) => `> ${line}`)
                  .join('\n');
                content = `\n\n> **Artifact: ${artTitle}**\n\n${quotedContent}\n\n`;
              } else {
                content = `\n\n> **Artifact: ${artTitle}**\n\`\`\`${artLang}\n${artContent}\n\`\`\`\n\n`;
              }
            } else {
              const header =
                el.querySelector('.flex.items-center.gap-2') || el.querySelector('.font-bold');
              const fallbackTitle = header ? header.innerText.split('\n')[0] : 'Unknown Artifact';
              content = `\n> [Artifact: ${fallbackTitle} - content extraction failed]\n`;
            }
          }
        } else {
          role = 'Claude';
          const clone = el.cloneNode(true);
          clone.querySelectorAll('button').forEach((btn) => btn.remove());
          content = convertToMarkdown(clone);
        }

        const trimmed = content?.trim();
        if (trimmed) {
          messages.push({ role, content: trimmed });
        }
      }
    };

    // Find actual scrollable container
    const scrollCandidates = [
      document.querySelector('main .overflow-y-auto'),
      document.querySelector('.overflow-y-auto'),
      document.querySelector('main'),
      document.scrollingElement || document.documentElement,
    ];
    const scrollContainer = scrollCandidates.find(
      (el) => el && el.scrollHeight > el.clientHeight + 40,
    );

    if (scrollContainer) {
      const origTop = scrollContainer.scrollTop;
      try {
        scrollContainer.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 140));
        await scan();

        const step = Math.max(300, Math.floor(scrollContainer.clientHeight * 0.75));
        let stalled = 0;
        while (
          scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight - 10 &&
          stalled < 3
        ) {
          const prevTop = scrollContainer.scrollTop;
          scrollContainer.scrollTop = Math.min(scrollContainer.scrollTop + step, scrollContainer.scrollHeight);
          await new Promise((r) => setTimeout(r, 120));
          await scan();

          if (scrollContainer.scrollTop === prevTop) {
            stalled++;
          } else {
            stalled = 0;
          }
        }

        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        await new Promise((r) => setTimeout(r, 120));
        await scan();
      } finally {
        scrollContainer.scrollTop = origTop;
      }
    } else {
      await scan();
    }

    return {
      title,
      messages,
      metadata: {
        Source: 'Claude',
        Date: new Date().toLocaleString(),
        Link: window.location.href,
        Model: 'Claude',
      },
    };
  }

  /**
   * Uses API messages when available, falling back to DOM extraction on empty results or errors.
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string, thinking?: string}>, metadata: Record<string, string>}>}
   */
  async parse() {
    try {
      const apiResult = await this.parseFromAPI();
      if (apiResult && apiResult.messages && apiResult.messages.length > 0) {
        return apiResult;
      }
    } catch (e) {
      console.warn('[ClaudeParser] API fetch failed, falling back to DOM extraction:', e);
    }

    return this.parseFromDOM();
  }
}
