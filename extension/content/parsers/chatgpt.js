import { ChatParser } from './base.js';
import { convertToMarkdown } from '../utils/html-to-markdown.js';
import {
  collectMountedTurnMessages,
  findChatGPTScrollRoot,
  getConversationTurns,
  TURN_SELECTOR,
} from './chatgpt_scroll_collector.js';

const TYPE_MAP = {
  tex: 'LaTeX',
  txt: 'Text',
  md: 'Markdown',
  pdf: 'PDF',
  doc: 'Document',
  docx: 'Document',
};

const FILE_PATTERN = /[a-zA-Z0-9_-]+\.(?:tex|txt|md|pdf|docx?)\b/gi;

export class ChatGPTParser extends ChatParser {
  isAvailable(url) {
    return url.includes('chatgpt.com');
  }

  getRoleElement(container) {
    if (container.matches?.('[data-message-author-role]')) return container;
    return container.querySelector?.('[data-message-author-role]') || null;
  }

  getRoleElements(container) {
    if (container.matches?.('[data-message-author-role]')) return [container];
    return Array.from(container.querySelectorAll?.('[data-message-author-role]') || []);
  }

  getMessageRole(container, roleElement) {
    const roleAttr = roleElement?.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr === 'user' ? 'User' : 'ChatGPT';

    const text = container.innerText || '';
    if (text.startsWith('You\n') || text.includes('\nYou\n')) return 'User';

    return 'ChatGPT';
  }

  getContentElement(container, roleElement) {
    if (roleElement?.getAttribute('data-message-author-role') === 'user') {
      return roleElement;
    }

    const selectors = ['.markdown', '.prose', '.whitespace-pre-wrap'];
    for (const selector of selectors) {
      const contentElement = container.querySelector?.(selector);
      if (contentElement) return contentElement;
    }

    return roleElement || (container.matches?.('article') ? container : null);
  }

  getContentElements(container, roleElements) {
    const contentElements = [];

    roleElements.forEach((roleElement) => {
      const contentElement = this.getContentElement(roleElement, roleElement);
      if (contentElement) contentElements.push(contentElement);
    });

    if (contentElements.length > 0) return contentElements;

    const fallback = this.getContentElement(container, roleElements[0]);
    return fallback ? [fallback] : [];
  }

  cleanContent(content) {
    return content
      .replace(/^Show moreShow less$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Identifies a message by message ID, turn ID, or virtual-item position, then node identity.
   * @param {Element} container - Message container or standalone role element.
   * @param {Element|null} roleElement - Element carrying the message author role, if present.
   * @param {string} role - Exported author role used to distinguish messages within a turn or item.
   * @returns {string|Element} Deduplication key; node identity is used when no stable ID exists.
   */
  getMessageKey(container, roleElement, role) {
    const idElement =
      roleElement?.closest?.('[data-message-id]') || container.querySelector?.('[data-message-id]');
    const messageId = idElement?.getAttribute('data-message-id');
    if (messageId) return messageId;

    const turnEl = container.closest?.(TURN_SELECTOR) || roleElement?.closest?.(TURN_SELECTOR);
    const turnId = turnEl?.getAttribute?.('data-testid');
    if (turnId) return `${turnId}:${role}`;

    const item = container.closest?.('[data-item-index], [data-index], [data-virtual-list-item-key]');
    if (item) {
      const attribute = ['data-item-index', 'data-index', 'data-virtual-list-item-key']
        .find((name) => item.hasAttribute(name));
      const siblings = Array.from(item.querySelectorAll('[data-message-author-role]'));
      return `${attribute}:${item.getAttribute(attribute)}:${role}:${siblings.indexOf(roleElement)}`;
    }

    // Without a stable ID, only repeated scans of the same node are duplicates.
    return roleElement || container;
  }

  extractAttachments(container) {
    const rawContent = container.textContent || container.innerText || '';
    if (!rawContent) return [];

    const matches = rawContent.match(FILE_PATTERN);
    if (!matches) return [];

    const attachments = [];
    const seenFiles = new Set();

    for (let i = 0; i < matches.length; i++) {
      const fileName = matches[i];
      if (!seenFiles.has(fileName)) {
        seenFiles.add(fileName);
        const fileExt = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        attachments.push({ name: fileName, type: TYPE_MAP[fileExt] || 'File' });
      }
    }

    return attachments;
  }

  extractImages(container) {
    const seenSrcs = new Set();
    const capturedImages = [];

    container.querySelectorAll?.('img').forEach((img) => {
      const src = img.getAttribute('src');
      const alt = img.getAttribute('alt') || 'Image';
      const isContentImage =
        src?.includes('backend-api') ||
        src?.includes('files') ||
        src?.startsWith('blob:') ||
        alt.includes('Uploaded') ||
        alt.includes('Generated');

      if (src && !seenSrcs.has(src) && isContentImage) {
        seenSrcs.add(src);
        capturedImages.push(`![${alt}](${src})`);
      }
    });

    return capturedImages;
  }

  appendAttachments(content, attachments, capturedImages) {
    const attachmentLines = [];
    const groupedAttachments = {};

    attachments.forEach((attachment) => {
      groupedAttachments[attachment.type] ||= [];
      groupedAttachments[attachment.type].push(attachment.name);
    });

    Object.entries(groupedAttachments).forEach(([type, files]) => {
      attachmentLines.push(`**${type} Files:**`);
      files.forEach((file) => attachmentLines.push(`- ${file}`));
      attachmentLines.push('');
    });

    if (capturedImages.length > 0) {
      if (attachmentLines.length > 0) attachmentLines.push('');
      attachmentLines.push('**Images:**');
      capturedImages.forEach((image) => attachmentLines.push(`- ${image}`));
    }

    if (attachmentLines.length === 0) return content;
    return `${content}\n\n**Attachments & Images:**\n${attachmentLines.join('\n')}`;
  }

  convertContentElement(contentElement) {
    return convertToMarkdown(contentElement);
  }

  /**
   * Converts message content to Markdown, removes interface controls, and appends attachments and images.
   * @param {Element} container - Mounted message container or standalone role element.
   * @returns {{role: string, content: string, key: string|Element}|null} Message with its deduplication key,
   *   or null when no content elements or exportable content are found.
   */
  extractMessage(container) {
    const roleElements = this.getRoleElements(container);
    const roleElement = roleElements[0] || this.getRoleElement(container);
    const contentElements = this.getContentElements(container, roleElements);
    if (contentElements.length === 0) return null;

    const role = this.getMessageRole(container, roleElement);
    const noiseSelector = '.flex.gap-2, button, .sr-only, [role="button"]';
    const contentParts = contentElements
      .map((contentElement) => {
        const clone = contentElement.cloneNode(true);
        clone.querySelectorAll(noiseSelector).forEach((node) => node.remove());
        return this.cleanContent(this.convertContentElement(clone));
      })
      .filter(Boolean);

    let content = contentParts.join('\n\n');
    content = this.appendAttachments(
      content,
      this.extractAttachments(container),
      this.extractImages(container),
    );

    if (!content) return null;

    return {
      role,
      content,
      key: this.getMessageKey(container, roleElement, role),
    };
  }

  extractMountedMessages() {
    const articles = Array.from(document.querySelectorAll('article'));
    const containers =
      articles.length > 0
        ? articles
        : Array.from(document.querySelectorAll('[data-message-author-role]'));

    return containers
      .map((container) => this.extractMessage(container))
      .filter(Boolean)
      .map(({ role, content }) => ({ role, content }));
  }

  /**
   * Collects messages while scrolling through mounted turns, then restores the scroll position.
   * @returns {Promise<Array<{role: string, content: string}>>} Messages ordered by turn index.
   */
  async extractAllConversationTurns() {
    return collectMountedTurnMessages({
      scrollRoot: findChatGPTScrollRoot([], document),
      extractMessage: (turn) => this.extractMessage(turn),
      doc: document,
    });
  }

  /**
   * Extracts the conversation, using iframe heuristics only when standard extraction is empty.
   * @param {{full?: boolean}} [options={}] Set full to false to read only mounted messages.
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string}>, metadata?: Record<string, string>}>}
   */
  async parse(options = {}) {
    const title = document.title || 'ChatGPT Session';
    const messages = [];

    const fullExport = options.full !== false;
    const extractedMessages = fullExport
      ? await this.extractAllConversationTurns()
      : this.extractMountedMessages();

    messages.push(
      ...(extractedMessages.length > 0 ? extractedMessages : this.extractMountedMessages()),
    );

    // If standard extraction found nothing, check if we have iframe-based content (deep research feature)
    if (messages.length === 0) {
      const iframes = document.querySelectorAll('iframe[src*="oaiusercontent.com"]');
      if (iframes.length > 0) {
        // Try multiple strategies to extract content
        let extractedContent = '';

        // Strategy 1: Look for data in script tags or window objects
        try {
          if (window.conversationData || window.chatData) {
            extractedContent = JSON.stringify(window.conversationData || window.chatData);
          }
        } catch (e) {
          console.log('Global data access failed:', e);
        }

        // Strategy 2: Look for preloaded content in hidden elements
        if (!extractedContent) {
          const hiddenSelectors = [
            '[data-conversation]',
            '[data-messages]',
            '.conversation-data',
            '.chat-transcript',
            'pre[data-conversation]',
          ];

          for (const selector of hiddenSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
              extractedContent = element.textContent;
              break;
            }
          }
        }

        // Strategy 3: Enhanced text extraction from main content
        if (!extractedContent) {
          const mainContent =
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.querySelector('.conversation') ||
            document.body;

          if (mainContent) {
            const textContent = mainContent.textContent || mainContent.innerText;
            if (textContent && textContent.trim()) {
              const lines = textContent.split('\n').filter((line) => line.trim());

              const conversationLines = lines.filter(
                (line) =>
                  line.length > 20 &&
                  !line.includes('ChatGPT') &&
                  !line.includes('Regenerate') &&
                  !line.includes('Copy code') &&
                  !line.includes('Continue') &&
                  !line.includes('Share') &&
                  !line.includes('Thumb') &&
                  !line.includes('New chat') &&
                  !line.includes('Menu') &&
                  !line.includes('Settings') &&
                  !line.includes('History'),
              );

              if (conversationLines.length > 0) {
                extractedContent = conversationLines.join('\n\n');
              }
            }
          }
        }

        if (!extractedContent) {
          const allText = document.body.textContent || document.body.innerText;
          if (allText && allText.trim().length > 100) {
            extractedContent = allText.trim();
          }
        }

        if (extractedContent) {
          const lines = extractedContent.split('\n').filter((line) => line.trim());
          lines.forEach((line) => {
            if (line.length > 10) {
              if (
                line.length < 200 ||
                line.includes('?') ||
                line.includes('write') ||
                line.includes('tell')
              ) {
                messages.push({
                  role: 'User',
                  content: line.trim(),
                });
              } else {
                messages.push({
                  role: 'ChatGPT',
                  content: line.trim(),
                });
              }
            }
          });
        }

        if (messages.length > 0) {
          messages.push({
            role: 'ChatGPT',
            content:
              '*Note: Content extracted from iframe-based ChatGPT interface. Some formatting may be lost.*',
          });
        } else {
          messages.push({
            role: 'ChatGPT',
            content:
              '*Note: ChatGPT is using iframe-based content that cannot be accessed by browser extensions. Please try exporting from a standard ChatGPT conversation.*',
          });
        }

        return { title, messages };
      }
    }

    const metadata = {
      Source: 'ChatGPT',
      Date: new Date().toLocaleString(),
      Link: window.location.href,
      Model:
        document.querySelector('[data-testid="model-selector-dropdown"]')?.innerText || 'ChatGPT',
    };

    return { title, messages, metadata };
  }
}
