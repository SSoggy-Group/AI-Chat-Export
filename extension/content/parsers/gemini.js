import { ChatParser } from './base.js';
import { convertToMarkdown } from '../utils/html-to-markdown.js';

export class GeminiParser extends ChatParser {
  isAvailable(url) {
    return url.includes('gemini.google.com');
  }

  async parse() {

    try {
      //1. Title Extraction - Enhanced for Deep Research
      let title = '';

      // Strategy 1: Check for Deep Research title patterns
      const deepResearchTitle = document.querySelector(
        'h1, .title, .conversation-title, [data-testid="title"]',
      );
      if (deepResearchTitle) {
        const text = deepResearchTitle.innerText.trim();
        if (
          text.length > 5 &&
          !text.includes('Gemini') &&
          !text.includes('Help') &&
          !text.includes('Settings')
        ) {
          title = text;
        }
      }

      // Strategy 2: Look for title in page content (Deep Research reports often have titles in content)
      if (!title) {
        const contentTitles = document.querySelectorAll(
          'main h1, main h2, article h1, article h2, .content h1, .content h2',
        );
        for (const el of contentTitles) {
          const text = el.innerText.trim();
          if (
            text.length > 5 &&
            !text.includes('Gemini') &&
            !text.includes('Help') &&
            !text.includes('Settings') &&
            !text.includes('Prompt:') &&
            !text.includes('Response:')
          ) {
            title = text;
            break;
          }
        }
      }

      // Strategy 3: Top Bar or Sidebar (original logic)
      if (!title) {
        const possibleHeaders = document.querySelectorAll(
          'h1, button[aria-haspopup="true"], button[aria-expanded]',
        );

        for (const el of possibleHeaders) {
          const text = el.innerText.trim();
          if (
            text.length > 5 &&
            !text.includes('Gemini') &&
            !text.includes('Help') &&
            !text.includes('Settings')
          ) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 100 && rect.left > 50) {
              title = text;
              break;
            }
          }
        }
      }

      if (!title) {
        const activeNav = document.querySelector('a[aria-current="page"], .selected');
        if (activeNav) title = activeNav.innerText;
      }

      if (!title) {
        title = document.title
          .replace(/Google/g, '')
          .replace(/Gemini/g, '')
          .replace(/- /g, '')
          .trim();
      }

      if (!title || title.length < 2) {
        title = 'Gemini Conversation';
      }


      const messages = [];
      const seenTexts = new Set();

      let extractionAttempted = false;

      // 2. Content Extraction - Enhanced for Deep Research
      // Try multiple strategies to extract content

      // Strategy 1: Original conversation containers
      const conversationContainers = document.querySelectorAll('.conversation-container');
      if (conversationContainers.length > 0) {
        extractionAttempted = true;
        conversationContainers.forEach((container) => {

          // First, check for user query
          const userQuery = container.querySelector('user-query');
          if (userQuery) {
            const queryText = userQuery.querySelector('.query-text');
            if (queryText) {
              const clone = queryText.cloneNode(true);
              clone
                .querySelectorAll('.cdk-visually-hidden, [class*="screen-reader"]')
                .forEach((el) => el.remove());
              const userText = clone.innerText.trim();
              if (userText && !seenTexts.has(userText)) {
                seenTexts.add(userText);
                messages.push({
                  role: 'User',
                  content: userText,
                });
              }
            }
          }

          // Then, check for model response
          const modelResponse = container.querySelector('model-response');
          if (modelResponse) {
            const messageContent = modelResponse.querySelector('message-content');
            if (messageContent) {
              const markdownDiv = messageContent.querySelector(
                '.markdown.markdown-main-panel, .markdown',
              );
              if (markdownDiv) {
                // Clone to avoid modifying the original DOM
                const clone = markdownDiv.cloneNode(true);

                // Remove UI elements that shouldn't be in the export
                clone
                  .querySelectorAll(
                    'button, .thoughts-container, .thoughts-wrapper, model-thoughts, .table-footer, .hide-from-message-actions',
                  )
                  .forEach((el) => el.remove());

                // Remove response-element wrappers (they contain export buttons)
                clone.querySelectorAll('response-element').forEach((el) => {
                  // Keep the table but remove the wrapper
                  while (el.firstChild) {
                    el.parentNode.insertBefore(el.firstChild, el);
                  }
                  el.remove();
                });

                // Convert to markdown
                const text = convertToMarkdown(clone);

                if (text && text.trim() && !seenTexts.has(text.trim())) {
                  seenTexts.add(text.trim());
                  messages.push({
                    role: 'Model',
                    content: text.trim(),
                  });
                }
              } else {

                // Strategy 1: Look for content in nested elements within message-content
                const nestedSelectors = [
                  'div[class*="content"]',
                  'div[class*="research"]',
                  'div[class*="report"]',
                  'div[class*="analysis"]',
                  'div[class*="section"]',
                  'div[class*="paragraph"]',
                  'p',
                  'article',
                  'section',
                ];

                let foundContent = false;
                for (const selector of nestedSelectors) {
                  const nestedElements = messageContent.querySelectorAll(selector);

                  nestedElements.forEach((element) => {
                    const text = element.innerText.trim();
                    if (text.length > 100) {

                      const isDeepResearch =
                        text.includes('research') ||
                        text.includes('analysis') ||
                        text.includes('findings') ||
                        text.includes('cost') ||
                        text.includes('sweetener') ||
                        text.includes('projection') ||
                        text.includes('historical') ||
                        text.includes('economic') ||
                        text.includes('market') ||
                        text.includes('price') ||
                        text.includes('industry');


                      if (!seenTexts.has(text)) {
                        seenTexts.add(text);
                        messages.push({
                          role: 'Model',
                          content: text,
                        });
                        foundContent = true;
                      }
                    }
                  });

                  if (foundContent) break;
                }

                // Strategy 2: Look for content in parent/sibling elements of model-response
                if (!foundContent) {
                  const parentContainer = modelResponse.parentElement;
                  if (parentContainer) {
                    const siblings = parentContainer.children;

                    Array.from(siblings).forEach((sibling) => {
                      if (sibling !== modelResponse) {
                        const text = sibling.innerText.trim();
                        if (text.length > 200) {

                          if (!seenTexts.has(text)) {
                            seenTexts.add(text);
                            messages.push({
                              role: 'Model',
                              content: text,
                            });
                            foundContent = true;
                          }
                        }
                      }
                    });
                  }
                }

                // Strategy 3: Look for content in the entire conversation container (outside model-response)
                if (!foundContent) {
                  const containerText = container.innerText.trim();

                  if (containerText.length > 500) {

                    if (!seenTexts.has(containerText)) {
                      seenTexts.add(containerText);
                      messages.push({
                        role: 'Model',
                        content: containerText,
                      });
                      foundContent = true;
                    }
                  }
                }

                // Strategy 4: Last resort - get all text from message-content
                if (!foundContent) {
                  const allText = messageContent.innerText.trim();

                  if (allText && allText.length > 50) {
                    // Check if this looks like Deep Research content
                    const isDeepResearch =
                      allText.includes('research') ||
                      allText.includes('analysis') ||
                      allText.includes('findings') ||
                      allText.includes('cost') ||
                      allText.includes('sweetener') ||
                      allText.includes('projection') ||
                      allText.includes('historical');


                    if (!seenTexts.has(allText)) {
                      seenTexts.add(allText);
                      messages.push({
                        role: 'Model',
                        content: allText,
                      });
                    }
                  }
                }
              }
            } else {
              // Fallback: get text directly from model-response
              const directText = modelResponse.innerText.trim();

              if (directText && directText.length > 50) {
                const isDeepResearch =
                  directText.includes('research') ||
                  directText.includes('analysis') ||
                  directText.includes('findings') ||
                  directText.includes('cost') ||
                  directText.includes('sweetener') ||
                  directText.includes('projection') ||
                  directText.includes('historical');


                if (!seenTexts.has(directText)) {
                  seenTexts.add(directText);
                  messages.push({
                    role: 'Model',
                    content: directText,
                  });
                }
              }
            }
          }
        });
      }

      // Strategy 2: Deep Research content extraction
      if (!extractionAttempted) {
        extractionAttempted = true;

        // First try Deep Research immersive panel structure
        const deepResearchPanel = document.querySelector('deep-research-immersive-panel');

        if (deepResearchPanel) {

          // Extract title from panel
          const panelTitle = deepResearchPanel.querySelector('.title-text, h2, h1');
          if (panelTitle && !title) {
            const titleText = panelTitle.innerText.trim();
            if (titleText.length > 5 && !titleText.includes('Gemini')) {
              title = titleText;
            }
          }

          // Extract content from panel
          const panelContent = this.extractDeepResearchPanelContent(deepResearchPanel);

          if (panelContent.length > 0) {
            panelContent.forEach((section) => {
              if (section.content && !seenTexts.has(section.content)) {
                seenTexts.add(section.content);
                messages.push({
                  role: section.role,
                  content: section.content,
                });
              }
            });
          } else {
          }
        } else {
        }

        // Fallback: Look for content in main, article, or content areas
        if (messages.length === 0) {
          const contentSelectors = [
            'main',
            'article',
            '.content',
            '.main-content',
            '[role="main"]',
            '.conversation-content',
            '.chat-content',
            '.message-content',
          ];

          let contentFound = false;

          for (const selector of contentSelectors) {
            const contentElement = document.querySelector(selector);
            if (contentElement) {
              // Extract all text content from the main content area
              const textContent = contentElement.innerText.trim();

              if (textContent && textContent.length > 100) {
                // Try to identify user prompts and responses
                const sections = this.extractDeepResearchSections(contentElement);

                if (sections.length > 0) {
                  sections.forEach((section) => {
                    if (section.content && !seenTexts.has(section.content)) {
                      seenTexts.add(section.content);
                      messages.push({
                        role: section.role,
                        content: section.content,
                      });
                    }
                  });
                  contentFound = true;
                  break;
                } else {
                  // If we can't parse sections, treat the whole content as a response
                  const markdown = convertToMarkdown(contentElement);
                  if (markdown && markdown.trim() && !seenTexts.has(markdown.trim())) {
                    seenTexts.add(markdown.trim());
                    messages.push({
                      role: 'Model',
                      content: markdown.trim(),
                    });
                    contentFound = true;
                    break;
                  }
                }
              }
            }
          }

          // Strategy 3: Fallback - look for any meaningful content
          if (!contentFound) {
            const bodyContent = document.body.innerText.trim();

            if (bodyContent && bodyContent.length > 200) {
              // Try to extract structured content from body
              const sections = this.extractDeepResearchSections(document.body);

              if (sections.length > 0) {
                sections.forEach((section) => {
                  if (section.content && !seenTexts.has(section.content)) {
                    seenTexts.add(section.content);
                    messages.push({
                      role: section.role,
                      content: section.content,
                    });
                  }
                });
              } else {
                // Last resort - treat as single response
                messages.push({
                  role: 'Model',
                  content: bodyContent,
                });
              }
            }
          }
        }
      }


      return {
        title: title,
        messages: messages,
        url: window.location.href, // Add URL for metadata
      };
    } catch (error) {
      console.error('[Gemini Parser] Error during parsing:', error);
      return {
        title: 'Gemini Conversation',
        messages: [],
        url: window.location.href,
      };
    }
  }

  // Helper method to extract sections from Deep Research content
  extractDeepResearchSections(contentElement) {
    const sections = [];
    const text = contentElement.innerText || '';

    // Look for common Deep Research patterns
    const patterns = [
      // Pattern 1: "Prompt:" and "Response:" sections
      {
        promptRegex:
          /(?:Prompt|You said)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:Response|I've completed|Generating|Start research)|$)/i,
        responseRegex:
          /(?:Response|I've completed|Generating|Start research)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:Prompt|You said)|$)/i,
      },
      // Pattern 2: Question/Answer format
      {
        promptRegex: /(?:Question|Q)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:Answer|A|Response)|$)/i,
        responseRegex: /(?:Answer|A|Response)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:Question|Q)|$)/i,
      },
      // Pattern 3: Look for research plan and results
      {
        promptRegex:
          /(?:Research plan|Research query|What is|How has|What's the projection)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:I've completed|Research|Analysis|Results)|$)/i,
        responseRegex:
          /(?:I've completed|Research|Analysis|Results|Findings)[:\s]*\n*([\s\S]*?)(?=\n\s*(?:Research plan|Research query|What is|How has)|$)/i,
      },
    ];

    // Try each pattern
    for (const pattern of patterns) {
      const promptMatches = text.match(pattern.promptRegex);
      const responseMatches = text.match(pattern.responseRegex);

      if (promptMatches && promptMatches[1]) {
        const promptContent = promptMatches[1].trim();
        if (promptContent.length > 20) {
          sections.push({
            role: 'User',
            content: promptContent,
          });
        }
      }

      if (responseMatches && responseMatches[1]) {
        const responseContent = responseMatches[1].trim();
        if (responseContent.length > 50) {
          sections.push({
            role: 'Model',
            content: responseContent,
          });
        }
      }

      // If we found meaningful sections, stop trying other patterns
      if (sections.length > 0) {
        return sections;
      }
    }

    // If no structured sections found, try to extract based on HTML structure
    const userElements = contentElement.querySelectorAll(
      '.user-query, .prompt, .question, [data-role="user"]',
    );
    userElements.forEach((el) => {
      const clone = el.cloneNode(true);
      clone
        .querySelectorAll('.cdk-visually-hidden, [class*="screen-reader"]')
        .forEach((subEl) => subEl.remove());
      const content = clone.innerText.trim();
      if (content.length > 20) {
        sections.push({
          role: 'User',
          content: content,
        });
      }
    });

    // Look for elements that might contain responses
    const responseElements = contentElement.querySelectorAll(
      '.model-response, .response, .answer, [data-role="model"], .research-content',
    );
    responseElements.forEach((el) => {
      const content = el.innerText.trim();
      if (content.length > 50) {
        sections.push({
          role: 'Model',
          content: content,
        });
      }
    });

    // If still no sections, try to split by common delimiters
    if (sections.length === 0) {
      const delimiterPattern =
        /\n\s*(?:You said|Response|Prompt|I've completed)\s*\n/i;
      const parts = text.split(delimiterPattern);

      parts.forEach((part, index) => {
        const trimmedPart = part.trim();
        if (trimmedPart.length > 50) {
          // Alternate between User and Model roles
          const role = index % 2 === 0 ? 'User' : 'Model';
          sections.push({
            role: role,
            content: trimmedPart,
          });
        }
      });
    }

    return sections;
  }

  // Helper method to extract content from Deep Research immersive panel
  extractDeepResearchPanelContent(panelElement) {
    const sections = [];


    try {
      // Look for content within panel
      const contentSelectors = [
        '.markdown',
        '.content',
        '.research-content',
        '.panel-content',
        'div[class*="content"]',
        'div[class*="markdown"]',
        'div[class*="research"]',
      ];

      for (const selector of contentSelectors) {
        const contentElements = panelElement.querySelectorAll(selector);
        contentElements.forEach((element) => {
          const text = element.innerText.trim();
          if (text.length > 100) {
            sections.push({
              role: 'Model',
              content: text,
            });
          }
        });
      }

      // If no structured content found, extract all text from panel
      if (sections.length === 0) {
        const panelText = panelElement.innerText.trim();
        if (panelText.length > 200) {
          // Try to split into logical sections
          const parts = this.splitIntoSections(panelText);
          parts.forEach((part) => {
            if (part.length > 50) {
              sections.push({
                role: 'Model',
                content: part,
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('[Gemini Parser] Error extracting panel content:', error);
    }

    return sections;
  }

  // Helper method to split text into logical sections
  splitIntoSections(text) {
    const sections = [];

    // Try to split by common delimiters
    const delimiters = [
      /\n\n+/g, // Double newlines
      /\n(?=[A-Z])/g, // Newline followed by capital letter
      /\.\s+/g, // Period followed by space
    ];

    let parts = [text];
    for (let i = 0; i < delimiters.length; i++) {
      const delimiter = delimiters[i];
      const nextParts = [];
      for (let j = 0; j < parts.length; j++) {
        const subParts = parts[j].split(delimiter);
        for (let k = 0; k < subParts.length; k++) {
          nextParts.push(subParts[k]);
        }
      }
      parts = nextParts;
    }

    // Filter and clean sections
    for (let i = 0; i < parts.length; i++) {
      const cleaned = parts[i].trim();
      if (cleaned.length > 50 && !/^\d+$/.test(cleaned)) {
        sections.push(cleaned);
      }
    }

    return sections;
  }
}
