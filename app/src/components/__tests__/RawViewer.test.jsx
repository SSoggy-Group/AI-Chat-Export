// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RawViewer, { formatChatAsText } from '../RawViewer';

describe('formatChatAsText', () => {
    it('formats a typical chat sequence correctly', () => {
        const chatData = {
            title: 'My Chat',
            content: [
                { source: 'user', message: 'Hello' },
                { source: 'claude', message: 'Hi there!' }
            ]
        };
        const expected = `# My Chat\n\n## You\n\nHello\n\n---\n\n## Claude\n\nHi there!\n\n---\n`;
        expect(formatChatAsText(chatData)).toBe(expected);
    });

    it('handles missing or non-array content', () => {
        const chatData = { title: 'Empty Chat' };
        expect(formatChatAsText(chatData)).toBe(`# Empty Chat\n`);

        const chatDataNonArray = { title: 'Non-Array Chat', content: 'hello' };
        expect(formatChatAsText(chatDataNonArray)).toBe(`# Non-Array Chat\n`);
    });

    it('handles empty content array', () => {
        const chatData = { title: 'Empty Array Chat', content: [] };
        expect(formatChatAsText(chatData)).toBe(`# Empty Array Chat\n`);
    });

    it('handles missing or null messages', () => {
        const chatData = {
            title: 'Missing Messages',
            content: [
                { source: 'user' },
                { source: 'claude', message: null }
            ]
        };
        const expected = `# Missing Messages\n\n## You\n\n\n\n---\n\n## Claude\n\n\n\n---\n`;
        expect(formatChatAsText(chatData)).toBe(expected);
    });
});

describe('RawViewer component', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        cleanup();
    });

    const renderRawViewer = (chatId = '123') => {
        return render(
            <MemoryRouter initialEntries={[`/raw/${chatId}`]}>
                <Routes>
                    <Route path="/raw/:chatId" element={<RawViewer />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders loading state initially and then formatted text on successful fetch', async () => {
        const mockData = {
            title: 'Test Chat',
            content: [{ source: 'user', message: 'Hello' }]
        };

        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData
        });

        renderRawViewer('123');

        expect(screen.getByText('Loading…')).not.toBeNull();

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('# Test Chat'))).not.toBeNull();
        });

        expect(document.title).toBe('Test Chat — raw');
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/chats/123');
    });

    it('displays error message from JSON response when fetch is not ok', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ msg: 'Chat not found' })
        });

        renderRawViewer('404');

        await waitFor(() => {
            expect(screen.getByText('Error: Chat not found')).not.toBeNull();
        });
    });

    it('falls back to HTTP status when fetch is not ok and JSON parsing fails', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error('Invalid JSON');
            }
        });

        renderRawViewer('500');

        await waitFor(() => {
            expect(screen.getByText('Error: HTTP 500')).not.toBeNull();
        });
    });

    it('falls back to HTTP status when JSON body does not contain msg property', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({})
        });

        renderRawViewer('400');

        await waitFor(() => {
            expect(screen.getByText('Error: HTTP 400')).not.toBeNull();
        });
    });

    it('displays error message when fetch network request fails', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('Network failure'));

        renderRawViewer('net-err');

        await waitFor(() => {
            expect(screen.getByText('Error: Network failure')).not.toBeNull();
        });
    });

    it('displays default error message when thrown error is not an Error instance', async () => {
        globalThis.fetch.mockRejectedValueOnce('Some string error');

        renderRawViewer('str-err');

        await waitFor(() => {
            expect(screen.getByText('Error: Failed to load')).not.toBeNull();
        });
    });
});
