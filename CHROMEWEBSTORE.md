# Chrome Web Store & Firefox Add-ons Listing — AI-Chat-Export

> Last Updated: 2026-05-25

## Store Listing

**Extension Name**
AI-Chat-Export

**Short Description**
Share and export your AI chats from Claude, ChatGPT, Gemini, DeepSeek, Mistral, Qwen, Meta AI, and Perplexity with one click.

**Detailed Description**
AI-Chat-Export is a lightweight, open-source browser extension that makes it effortless to share and export your conversations from all major AI chat platforms with a single click.

Supported AI Bots:
- Claude (claude.ai)
- ChatGPT (chatgpt.com)
- DeepSeek (chat.deepseek.com)
- Mistral (chat.mistral.ai)
- Gemini (gemini.google.com)
- Qwen (chat.qwenlm.ai)
- Meta AI (meta.ai)
- Perplexity (perplexity.ai)

Key Features:
- Instantly share conversations with a unique URL, similar to an unlisted video.
- Export chats locally as Markdown (.md), Plain Text (.txt), JSON, HTML, or Word document (.docx).
- Captures formatting, code blocks, and artifacts, including Mermaid diagrams and syntax highlighting.
- Fast, secure, and privacy-oriented.

How it works:
When you share a conversation, the extension saves the conversation content to our database (https://ai.ssoggy.me) and copies a unique sharing link to your clipboard. Only users with the link can view it; your conversations are not indexed by search engines.

Privacy & Security:
We do not use analytics, trackers, or capture personal identification. Only the text of the chat you explicitly click to share is transmitted off-device to host your public link.

**Category**
Productivity / Developer Tools

**Single Purpose**
Enables users to share and export their AI chat conversations from supported web platforms with one click.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename / Description |
|-------|-----------|--------|------------------------|
| Store Icon | 128×128 PNG | ✅ Ready | `extension/images/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | Showing button placement inside the chat interface |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | Showing the share popup options (Share / Export formats) |
| Screenshot 3 | 1280×800 or 640×400 | ⬜ Not created | Showing the resulting shared chat page layout |
| Small Promo Tile | 440×280 | ⬜ Not created | Clean promo banner with extension logo and support badges |

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `clipboardWrite` | permissions | Required to automatically copy the generated shareable conversation link to the user's clipboard upon clicking "Share to AI-Chat-Export". |
| `https://claude.ai/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Claude. |
| `https://chatgpt.com/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on ChatGPT. |
| `https://chat.deepseek.com/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on DeepSeek. |
| `https://chat.mistral.ai/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Mistral. |
| `https://gemini.google.com/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Gemini. |
| `https://chat.qwenlm.ai/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Qwen. |
| `https://www.meta.ai/*` & `https://meta.ai/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Meta AI. |
| `https://www.perplexity.ai/*` & `https://perplexity.ai/*` | host_permissions | Required to run content scripts to parse the chat DOM and inject the export UI on Perplexity. |
| `https://ai.ssoggy.me/*` | host_permissions | Required to send shared chat JSON payloads to our hosting backend to save and retrieve shared links. |

---

## Privacy & Data Use

### Data Collection
**Does the extension collect user data?** Yes (only when explicitly requested by user actions).

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Website content (Chat Log) | Yes | Yes (Only when clicking "Share") | Used to host the conversation on our web viewer. | No |

### Data Use Certification
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality (sharing/viewing).
- [x] Data is NOT used for creditworthiness or lending purposes.

---

## Privacy Policy
**Privacy Policy URL**
`https://ai.ssoggy.me/privacy-policy`

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| v0.4.0 | 2026-05-25 | Universal extension update adding multi-bot support for 8 AI platforms (Claude, ChatGPT, Gemini, DeepSeek, Mistral, Qwen, Meta AI, Perplexity) and visual refresh. | Draft |
