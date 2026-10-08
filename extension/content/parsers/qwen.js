import { ChatParser } from './base.js';
import { convertToMarkdown } from '../utils/html-to-markdown.js';

export class QwenParser extends ChatParser {
  isAvailable(url) {
    return url.includes('qwen.ai') || url.includes('qwenlm.ai');
  }

  async parse() {
    // Try to get the actual chat title from multiple possible selectors
    const titleSelectors = [
      '.chat-item-drag-link-content-tip-text',
      '.ant-tooltip-inner',
      'input[placeholder*="title"]',
      '.chat-title',
      'h1',
      'title',
    ];

    let title = 'Qwen Chat';
    for (let i = 0; i < titleSelectors.length; i++) {
      const element = document.querySelector(titleSelectors[i]);
      if (element) {
        const text = element.textContent || element.value || element.innerText;
        if (text && text.trim() && text !== document.title) {
          title = text.trim();
          break;
        }
      }
    }

    // chat.qwen.ai uses specific class names
    const chatMessages = document.querySelectorAll('.qwen-chat-message');
    if (chatMessages.length === 0) {
      return { title, messages: [] };
    }

    // Check once if there are any file attachments present in the entire document
    const hasAttachmentsInDoc = document.querySelector('.index-module__file-message-document___OjWnc') !== null;

    const messages = [];

    for (let i = 0; i < chatMessages.length; i++) {
      const message = chatMessages[i];
      const isUser = message.classList.contains('qwen-chat-message-user');
      const role = isUser ? 'User' : 'Qwen';

      let content = '';
      let attachments = [];

      if (isUser) {
        // Extract attachments first (only if document has attachments and this message contains attachment elements)
        if (hasAttachmentsInDoc && message.querySelector('.index-module__file-message-document___OjWnc')) {
          const fileItems = message.querySelectorAll('.index-module__file-message-document___OjWnc');
          for (let j = 0; j < fileItems.length; j++) {
            const item = fileItems[j];
            const fileNameEl = item.querySelector('.fileitem-file-name-text');
            const fileExtEl = item.querySelector('.fileitem-file-name-ext');
            const fileSizeEl = item.querySelector('.fileitem-file-size span');

            if (fileNameEl && fileExtEl) {
              const fileName = fileNameEl.textContent.trim();
              const fileExt = fileExtEl.textContent.trim();
              const fileSize = fileSizeEl ? fileSizeEl.textContent.trim() : '';

              attachments.push({
                name: fileName + fileExt,
                size: fileSize,
              });
            }
          }
        }

        // User messages are in .user-message-content
        const userContent = message.querySelector('.user-message-content');
        if (userContent) {
          content = convertToMarkdown(userContent);
        }
      } else {
        // Assistant messages are in .qwen-markdown elements
        const markdownContent = message.querySelector('.qwen-markdown');
        if (markdownContent) {
          content = convertToMarkdown(markdownContent);
        }
      }

      // Add attachments to content if any exist
      if (attachments.length > 0) {
        const attachmentList = attachments
          .map((att) => `- **${att.name}** (${att.size})`)
          .join('\n');
        content = content + '\n\n**Attachments:**\n' + attachmentList;
      }

      if (content && content.trim()) {
        messages.push({ role, content: content.trim() });
      }
    }

    return { title, messages };
  }
}
