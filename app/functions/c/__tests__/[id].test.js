import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestGet } from '../[id].js';
import * as drizzleD1 from 'drizzle-orm/d1';

vi.mock('drizzle-orm/d1', () => ({
    drizzle: vi.fn()
}));

describe('c/[id].js onRequestGet', () => {
    let mockContext;
    let mockDb;
    let mockHandlers;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn()
        };

        drizzleD1.drizzle.mockReturnValue(mockDb);

        mockHandlers = {};
        const mockRewriter = {
            on: vi.fn((selector, handler) => {
                mockHandlers[selector] = handler;
                return mockRewriter;
            }),
            transform: vi.fn(res => res)
        };

        vi.stubGlobal('HTMLRewriter', function () {
            return mockRewriter;
        });

        mockContext = {
            params: { id: 'test-chat-id' },
            env: {
                DB: {},
                ASSETS: {
                    fetch: vi.fn().mockImplementation(() =>
                        Promise.resolve({
                            headers: new Headers({ 'Content-Type': 'text/html' })
                        })
                    )
                }
            },
            request: {
                headers: new Headers([['User-Agent', 'Mozilla/5.0']])
            }
        };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('falls back to static assets when chat is not found', async () => {
        mockDb.limit.mockResolvedValue([]);

        const response = await onRequestGet(mockContext);

        expect(mockContext.env.ASSETS.fetch).toHaveBeenCalledWith(mockContext.request);
        expect(response).toBeDefined();
    });

    it('serves raw markdown wrapped in simple HTML for AI bot user agents', async () => {
        mockContext.request = {
            headers: new Headers([['User-Agent', 'Mozilla/5.0 (compatible; ChatGPT-User/1.0)']])
        };

        const mockChat = {
            id: 'test-chat-id',
            title: 'Test Chat Title',
            content: [
                { source: 'user', message: 'Hello' },
                { source: 'claude', message: 'Hi there!' }
            ]
        };
        mockDb.limit.mockResolvedValue([mockChat]);

        const response = await onRequestGet(mockContext);
        const text = await response.text();

        expect(response.headers.get('Content-Type')).toContain('text/html');
        expect(text).toContain('<title>Test Chat Title - AI-Chat-Export</title>');
        expect(text).toContain('# Test Chat Title');
        expect(text).toContain('Hi there!');
    });

    it('escapes special HTML characters in title and content for AI bot user agents', async () => {
        mockContext.request = {
            headers: new Headers([['User-Agent', 'Mozilla/5.0 (compatible; ClaudeBot/1.0)']])
        };

        const mockChat = {
            id: 'xss-chat',
            title: 'Test <script>alert(1)</script> & "Quotes" \'Single\'',
            content: [
                { source: 'user', message: 'Hello <img src=x onerror=alert(1)> & "more"' }
            ]
        };
        mockDb.limit.mockResolvedValue([mockChat]);

        const response = await onRequestGet(mockContext);
        const text = await response.text();

        expect(text).toContain('<title>Test &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Quotes&quot; &#39;Single&#39; - AI-Chat-Export</title>');
        expect(text).not.toContain('<script>alert(1)</script>');
        expect(text).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;more&quot;');
    });

    it('injects SEO tags and fallback content in div#root for standard browser requests', async () => {
        const mockChat = {
            id: 'test-chat-id',
            title: 'Test <Chat>',
            content: [
                { source: 'user', message: 'Question' },
                { source: 'claude', message: 'Answer' }
            ]
        };
        mockDb.limit.mockResolvedValue([mockChat]);

        await onRequestGet(mockContext);

        expect(mockHandlers['div#root']).toBeDefined();

        const mockElement = {
            setInnerContent: vi.fn()
        };
        mockHandlers['div#root'].element(mockElement);

        expect(mockElement.setInnerContent).toHaveBeenCalledWith(
            expect.stringContaining('<main style="padding: 2rem; font-family: sans-serif; white-space: pre-wrap;">'),
            { html: true }
        );
        expect(mockElement.setInnerContent).toHaveBeenCalledWith(
            expect.stringContaining('<h1>Test &lt;Chat&gt;</h1>'),
            { html: true }
        );
    });
});
