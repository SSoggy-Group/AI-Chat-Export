import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '../_middleware.js';

describe('_middleware CORS handling', () => {
    const createMockContext = (method, origin) => {
        const headers = new Map();
        if (origin) {
            headers.set('Origin', origin);
        }
        return {
            request: {
                method,
                headers: {
                    get: (name) => headers.get(name) || null,
                },
            },
            next: vi.fn().mockResolvedValue(new Response('OK', { status: 200 })),
        };
    };

    it('should set Access-Control-Allow-Origin for allowed origins', async () => {
        const context = createMockContext('GET', 'https://claude.ai');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://claude.ai');
    });

    it('should NOT set Access-Control-Allow-Origin for arbitrary chrome-extension origin', async () => {
        const context = createMockContext('GET', 'chrome-extension://abcdefghijklmnopqrstuvwxyz123456');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should NOT set Access-Control-Allow-Origin for arbitrary moz-extension origin', async () => {
        const context = createMockContext('GET', 'moz-extension://12345678-1234-1234-1234-123456789abc');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should NOT set Access-Control-Allow-Origin for unauthorized web origins', async () => {
        const context = createMockContext('GET', 'https://malicious.com');
        const response = await onRequest(context);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should handle OPTIONS preflight request for allowed origin', async () => {
        const context = createMockContext('OPTIONS', 'https://ai.ssoggy.me');
        const response = await onRequest(context);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://ai.ssoggy.me');
    });

    it('should handle OPTIONS preflight request for disallowed extension origin without setting origin header', async () => {
        const context = createMockContext('OPTIONS', 'chrome-extension://malicious-extension-id');
        const response = await onRequest(context);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
});
