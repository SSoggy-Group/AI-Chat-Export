import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../[id]/raw.js';
import * as drizzleD1 from 'drizzle-orm/d1';

vi.mock('drizzle-orm/d1', () => ({
    drizzle: vi.fn()
}));

describe('chats/[id]/raw.js onRequestGet', () => {
    let mockContext;
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn()
        };

        drizzleD1.drizzle.mockReturnValue(mockDb);

        mockContext = {
            params: { id: 'test-raw-id' },
            env: { DB: {} },
            request: {
                headers: new Headers([['Origin', 'https://claude.ai']])
            }
        };
    });

    it('returns 200 with formatted raw markdown plain text when chat is found', async () => {
        const mockChat = {
            id: 'test-raw-id',
            title: 'Sample Chat Title',
            content: [
                { source: 'user', message: 'Hello Claude' },
                { source: 'claude', message: 'Hello! How can I help you today?' }
            ]
        };
        mockDb.limit.mockResolvedValue([mockChat]);

        const response = await onRequestGet(mockContext);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');

        const text = await response.text();
        const expectedBody = [
            '# Sample Chat Title',
            '',
            '## You',
            '',
            'Hello Claude',
            '',
            '---',
            '',
            '## Claude',
            '',
            'Hello! How can I help you today?',
            '',
            '---',
            ''
        ].join('\n');

        expect(text).toBe(expectedBody);
    });

    it('handles edge cases such as non-array content and null/undefined message values', async () => {
        const mockChatNoArray = {
            id: 'test-raw-id-2',
            title: 'Chat with invalid content format',
            content: null
        };
        mockDb.limit.mockResolvedValue([mockChatNoArray]);

        const response1 = await onRequestGet(mockContext);
        const text1 = await response1.text();
        expect(text1).toBe('# Chat with invalid content format\n');

        const mockChatNullMsg = {
            id: 'test-raw-id-3',
            title: 'Chat with null message',
            content: [
                { source: 'user', message: null },
                { source: 'other', message: undefined }
            ]
        };
        mockDb.limit.mockResolvedValue([mockChatNullMsg]);

        const response2 = await onRequestGet(mockContext);
        const text2 = await response2.text();
        const expectedBody2 = [
            '# Chat with null message',
            '',
            '## You',
            '',
            '',
            '',
            '---',
            '',
            '## Claude',
            '',
            '',
            '',
            '---',
            ''
        ].join('\n');
        expect(text2).toBe(expectedBody2);
    });

    it('returns 404 with plain text message when chat is not found', async () => {
        mockDb.limit.mockResolvedValue([]);

        const response = await onRequestGet(mockContext);

        expect(response.status).toBe(404);
        expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');

        const text = await response.text();
        expect(text).toBe('Chat not found');
    });

    it('returns 500 when database operation throws an error', async () => {
        const dbError = new Error('Database connection failed');
        mockDb.limit.mockRejectedValue(dbError);

        const response = await onRequestGet(mockContext);

        expect(response.status).toBe(500);
        expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

        const text = await response.text();
        expect(text).toBe('Something went wrong!');
    });
});
