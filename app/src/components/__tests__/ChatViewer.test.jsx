// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChatViewer from '../ChatViewer';

describe('ChatViewer component', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('location', {
            hostname: 'shareclaude.pages.dev',
            origin: 'https://shareclaude.pages.dev',
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        cleanup();
    });

    const renderChatViewer = (chatId = '123') => {
        return render(
            <MemoryRouter initialEntries={[`/chat/${chatId}`]}>
                <Routes>
                    <Route path="/chat/:chatId" element={<ChatViewer />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders loading spinner state initially', () => {
        globalThis.fetch.mockReturnValueOnce(new Promise(() => {}));

        const { container } = renderChatViewer('123');

        const spinner = container.querySelector('.animate-spin');
        expect(spinner).not.toBeNull();
    });

    it('renders chat conversation successfully on standard production host', async () => {
        const mockChatData = {
            title: 'My Claude Chat',
            content: [
                { source: 'user', message: 'Hello Claude' },
                { source: 'claude', message: 'Hello! How can I help you today?' },
            ],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('123');

        await waitFor(() => {
            expect(screen.getByText('My Claude Chat')).not.toBeNull();
        });

        expect(screen.getByText('Hello Claude')).not.toBeNull();
        expect(screen.getByText('Hello! How can I help you today?')).not.toBeNull();
        expect(document.title).toBe('My Claude Chat — Claude | AI-Chat-Export');

        const rawLink = screen.getByRole('link', { name: /raw/i });
        expect(rawLink.getAttribute('href')).toBe('/api/chats/123/raw');

        const botLink = screen.getByRole('link', { name: /Claude/i });
        expect(botLink.getAttribute('href')).toBe('https://claude.ai');
    });

    it('detects different bot types (ChatGPT) and sets titles and links accordingly', async () => {
        const mockChatData = {
            title: 'ChatGPT Discussion',
            content: [
                { source: 'user', message: 'What is 2+2?' },
                { source: 'chatgpt', message: '2+2 is 4.' },
            ],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('456');

        await waitFor(() => {
            expect(screen.getByText('ChatGPT Discussion')).not.toBeNull();
        });

        expect(document.title).toBe('ChatGPT Discussion — ChatGPT | AI-Chat-Export');

        const botLink = screen.getByRole('link', { name: /ChatGPT/i });
        expect(botLink.getAttribute('href')).toBe('https://chatgpt.com');
    });

    it('detects bot types without a website URL in BOT_URLS (e.g., Gemini) and falls back to default title', async () => {
        const mockChatData = {
            title: 'Gemini Query',
            content: [
                { source: 'human', message: 'Explain gravity' },
                { source: 'gemini', message: 'Gravity is a fundamental interaction...' },
            ],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('789');

        await waitFor(() => {
            expect(screen.getByText('Gemini Query')).not.toBeNull();
        });

        expect(document.title).toBe('Gemini Query — Gemini | AI-Chat-Export');
        expect(screen.queryByRole('link', { name: /Gemini/i })).toBeNull();
    });

    it('handles empty content array gracefully', async () => {
        const mockChatData = {
            title: 'Empty Content',
            content: [],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('no-content');

        await waitFor(() => {
            expect(screen.getByText('Empty Content')).not.toBeNull();
        });

        expect(document.title).toBe('Empty Content — Claude | AI-Chat-Export');
    });

    it('handles missing title by defaulting title to Chat', async () => {
        const mockChatData = {
            content: [{ source: 'user', message: 'Hi' }],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('no-title');

        await waitFor(() => {
            expect(document.title).toBe('Chat — Claude | AI-Chat-Export');
        });
    });

    it('handles mouse enter and leave events on bot link', async () => {
        const mockChatData = {
            title: 'DeepSeek Chat',
            content: [
                { source: 'user', message: 'Test DeepSeek' },
                { source: 'deepseek', message: 'DeepSeek answer' },
            ],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('ds-1');

        await waitFor(() => {
            expect(screen.getByText('DeepSeek Chat')).not.toBeNull();
        });

        const botLink = screen.getByRole('link', { name: /DeepSeek/i });
        fireEvent.mouseEnter(botLink);
        fireEvent.mouseLeave(botLink);
    });

    it('handles local dev environment (localhost): sets prod raw href and retries fetch with PROD_API_ORIGIN on local fetch failure', async () => {
        vi.stubGlobal('location', {
            hostname: 'localhost',
            origin: 'http://localhost:3000',
        });

        const mockChatData = {
            title: 'Local Dev Chat',
            content: [
                { source: 'user', message: 'Dev test' },
                { source: 'claude', message: 'Dev reply' },
            ],
        };

        globalThis.fetch.mockRejectedValueOnce(new Error('Local dev server down'));
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('local-123');

        await waitFor(() => {
            expect(screen.getByText('Local Dev Chat')).not.toBeNull();
        });

        expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/chats/local-123');
        expect(globalThis.fetch).toHaveBeenCalledWith('https://ai.ssoggy.me/api/chats/local-123');

        const rawLink = screen.getByRole('link', { name: /raw/i });
        expect(rawLink.getAttribute('href')).toBe('https://ai.ssoggy.me/api/chats/local-123/raw');
    });

    it('handles local dev environment (127.0.0.1) as local dev host', async () => {
        vi.stubGlobal('location', {
            hostname: '127.0.0.1',
            origin: 'http://127.0.0.1:3000',
        });

        const mockChatData = {
            title: '127.0.0.1 Dev Chat',
            content: [
                { source: 'user', message: 'IP test' },
            ],
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockChatData,
        });

        renderChatViewer('ip-123');

        await waitFor(() => {
            expect(screen.getByText('127.0.0.1 Dev Chat')).not.toBeNull();
        });

        const rawLink = screen.getByRole('link', { name: /raw/i });
        expect(rawLink.getAttribute('href')).toBe('https://ai.ssoggy.me/api/chats/ip-123/raw');
    });

    it('displays error message when fetch returns non-ok HTTP status', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            headers: new Headers({ 'content-type': 'application/json' }),
        });

        renderChatViewer('not-found');

        await waitFor(() => {
            expect(screen.getByText('Error: HTTP error! Status: 404')).not.toBeNull();
        });
    });

    it('displays error message when fetch returns non-JSON content-type', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: async () => '<html>404 Not Found</html>',
        });

        renderChatViewer('non-json');

        await waitFor(() => {
            expect(screen.getByText('Error: <html>404 Not Found</html>')).not.toBeNull();
        });
    });

    it('displays fallback non-JSON error message when non-JSON body is empty', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: async () => '',
        });

        renderChatViewer('empty-non-json');

        await waitFor(() => {
            expect(screen.getByText('Error: API returned a non-JSON response')).not.toBeNull();
        });
    });

    it('displays error message when network request fails on all origins', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('Network error'));

        renderChatViewer('net-fail');

        await waitFor(() => {
            expect(screen.getByText('Error: Network error')).not.toBeNull();
        });
    });

    it('displays default error message when thrown error is not an Error instance', async () => {
        globalThis.fetch.mockRejectedValueOnce('Unexpected failure string');

        renderChatViewer('unknown-err');

        await waitFor(() => {
            expect(screen.getByText('Error: An error occurred')).not.toBeNull();
        });
    });
});
