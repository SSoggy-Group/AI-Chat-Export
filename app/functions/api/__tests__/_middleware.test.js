import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '../_middleware.js';

describe('API middleware CORS', () => {
    const createMockContext = (origin, method = 'GET') => {
        const headers = new Headers();
        if (origin) {
            headers.set('Origin', origin);
        }
        const request = new Request('https://ai.ssoggy.me/api/chats', {
            method,
            headers,
        });

        const nextResponse = new Response('ok', { status: 200 });

        return {
            request,
            next: vi.fn().mockResolvedValue(nextResponse)
        };
    };

    it('sets CORS headers for allowed origin', async () => {
        const context = createMockContext('https://claude.ai');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');
    });

    it('does not set CORS header for arbitrary extension origin', async () => {
        const context = createMockContext('chrome-extension://maliciousid');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('handles OPTIONS preflight request correctly for allowed origin', async () => {
        const context = createMockContext('https://claude.ai', 'OPTIONS');
        const response = await onRequest(context);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');
    });
});
