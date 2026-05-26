# [AI-Chat-Export](https://ai.ssoggy.me)

Browser extension to share and export your AI chats from Claude, ChatGPT, DeepSeek, Mistral, Gemini, Qwen, Meta AI, and Perplexity with one click.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/pcpjdbnjhgofgjgegodlnebdnmiddmaa?color=blue&label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://example.com/)
[![Firefox Add-ons](https://img.shields.io/amo/v/ai-chat-export?color=orange&label=Firefox%20Add-ons&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/ai-chat-export-share/)
[![GitHub Release](https://img.shields.io/github/v/release/SSoggy-Group/AI-Chat-Export?color=success&logo=github)](https://github.com/SSoggy-Group/AI-Chat-Export/releases/latest)
[![Website](https://img.shields.io/badge/Website-ai.ssoggy.me-blue?logo=vercel)](https://ai.ssoggy.me)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- One-click sharing of AI conversations from multiple platforms
- Instant URL generation
- Supports syntax highlighting for code and artifacts, including Mermaid and JSON
- Works directly with the native web interfaces of supported AI platforms

## How It Works

When you share a conversation, the extension stores the conversation in AI-Chat-Export's database, not the original AI platform's database. Each conversation gets a unique URL, similar to an unlisted YouTube video. The URL can be shared with anyone, but it won't show up in Google search results.
Shared conversations are served from AI-Chat-Export's database.

*Important: While the URL is private and not searchable, anyone with the URL can still view the conversation. Please avoid sharing sensitive or personal information.*

## How to Use

1. Open a supported AI chat interface (e.g., [Claude](https://claude.ai), [ChatGPT](https://chatgpt.com)) in your browser
2. Start or continue a conversation
3. Click the **AI-Chat-Export** button in the chat interface or use the extension popup
4. A menu appears with options:
   - **Share to AI-Chat-Export:** Uploads the conversation and copies the link to your clipboard
   - **Export:** Downloads the conversation as HTML, Markdown, plain text, JSON, or Word (.docx)

## Tech Stack

- **Frontend**: React, TailwindCSS
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1

## Installation

### Chrome

For development/debugging:

1. Clone this repository:

   ```bash
   git clone https://github.com/SSoggy-Group/AI-Chat-Export.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `extension` folder from the cloned repository

### Firefox

For development/debugging:

1. Clone this repository:

   ```bash
   git clone https://github.com/SSoggy-Group/AI-Chat-Export.git
   ```

2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file inside the `extension` folder from the cloned repository

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests

## Links

- [Website](https://ai.ssoggy.me)

---

## Star History

<!-- markdownlint-disable MD033 -->
<a href="https://www.star-history.com/?repos=SSoggy-Group%2FAI-Chat-Export&type=date&legend=top-left">
 <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=SSoggy-Group/AI-Chat-Export&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=SSoggy-Group/AI-Chat-Export&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=SSoggy-Group/AI-Chat-Export&type=date&legend=top-left" />
 </picture>
</a>
<!-- markdownlint-enable MD033 -->

Made with ☕ for the AI community


NOTE: 
I didn't make the core of thi sproject, but the repo owner didn't want to merge my pull request that would fix the repo, so I guess use this fork now
about usage of ai: gemini helped me with parts of my version of ai-chat-export

## Acknowledgements

- Special thanks to [rohit1kumar's shareclaude](https://github.com/rohit1kumar/shareclaude) for the original backend and website foundation that this extended fork builds upon.
- Special thanks to [ai-chat-exporter by Rat-S](https://github.com/Rat-S/ai-chat-exporter) for the original injection and downloading logic used for several of the supported sites (except Claude and Grok).
