import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { chatsSchema } from '../../database/schema';

// List of known AI Live-Fetching Bots (User-Requested Bots)
const AI_BOT_REGEX = /bot|spider|crawl|chatgpt|perplexity|claude|meta|anthropic|omgili|facebook|twitter|slack|discord/i;

export async function onRequestGet(context) {
    const request = context.request;
    const id = context.params.id;
    const userAgent = request.headers.get('User-Agent') || '';
    const isAIBot = AI_BOT_REGEX.test(userAgent);

    try {
        const db = drizzle(context.env.DB);
        const [chat] = await db.select().from(chatsSchema).where(eq(chatsSchema.id, id)).limit(1);

        // If chat is not found, fallback to standard routing (which serves index.html and handles 404 client-side)
        if (!chat) {
            return context.env.ASSETS.fetch(request);
        }

        // Prepare the raw markdown
        const messages = Array.isArray(chat.content) ? chat.content : [];
        const lines = [`# ${chat.title}`, ''];
        for (const { source, message } of messages) {
            const role = source === 'user' ? 'You' : 'Claude';
            lines.push(`## ${role}`, '', message ?? '', '', '---', '');
        }
        const markdown = lines.join('\n');

        // OPTION 1: If it's an AI bot, serve the raw markdown directly
        if (isAIBot) {
            return new Response(markdown, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600'
                },
            });
        }

        // OPTION 2: If it's a regular browser, fetch the static HTML and inject SEO data
        const assetResponse = await context.env.ASSETS.fetch(request);
        
        // Ensure we're only rewriting HTML
        const contentType = assetResponse.headers.get('Content-Type') || '';
        if (!contentType.includes('text/html')) {
            return assetResponse;
        }

        const safeTitle = chat.title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeMarkdown = markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Define HTML rewrites
        const rewriter = new HTMLRewriter()
            // 1. Rewrite <title>
            .on('title', {
                element(element) {
                    element.setInnerContent(`${safeTitle} - AI-Chat-Export`);
                }
            })
            // 2. Rewrite meta descriptions
            .on('meta[name="description"]', {
                element(element) {
                    element.setAttribute('content', `Read the conversation: ${safeTitle}`);
                }
            })
            .on('meta[property="og:title"]', {
                element(element) {
                    element.setAttribute('content', safeTitle);
                }
            })
            .on('meta[property="og:description"]', {
                element(element) {
                    element.setAttribute('content', `Read the conversation: ${safeTitle}`);
                }
            })
            .on('meta[name="twitter:title"]', {
                element(element) {
                    element.setAttribute('content', safeTitle);
                }
            })
            .on('meta[name="twitter:description"]', {
                element(element) {
                    element.setAttribute('content', `Read the conversation: ${safeTitle}`);
                }
            })
            // 3. Inject text directly into the <body> for all crawlers
            .on('body', {
                append(element) {
                    element.append(`<div id="ai-chat-raw-data" style="display:none; white-space:pre-wrap;">${safeMarkdown}</div>`, { html: true });
                }
            });

        return rewriter.transform(assetResponse);
    } catch (error) {
        // Fallback to static asset if there's a DB error so it doesn't hard-crash the frontend load
        return context.env.ASSETS.fetch(request);
    }
}
