import { describe, it, expect } from 'vitest';
import { getCorsHeaders, getReadableError } from '../utils.js';

describe('getCorsHeaders', () => {
    it('returns default CORS headers regardless of origin', () => {
        const headers = getCorsHeaders(undefined);
        expect(headers).toEqual({
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
        });
    });

    it('sets Access-Control-Allow-Origin for whitelisted origins', () => {
        const allowedOrigins = [
            'https://claude.ai',
            'https://ai.ssoggy.me',
            'http://localhost:4000',
        ];

        for (const origin of allowedOrigins) {
            const headers = getCorsHeaders(origin);
            expect(headers['Access-Control-Allow-Origin']).toBe(origin);
        }
    });

    it('sets Access-Control-Allow-Origin for browser extensions', () => {
        const chromeOrigin = 'chrome-extension://abcdefghijklmnopqrstuvwxyz';
        const mozOrigin = 'moz-extension://12345678-1234-1234-1234-123456789abc';

        expect(getCorsHeaders(chromeOrigin)['Access-Control-Allow-Origin']).toBe(chromeOrigin);
        expect(getCorsHeaders(mozOrigin)['Access-Control-Allow-Origin']).toBe(mozOrigin);
    });

    it('does not set Access-Control-Allow-Origin for unauthorized or malformed origins', () => {
        const invalidOrigins = [
            'https://evil.com',
            'https://notclaude.ai',
            'http://localhost:3000',
            '',
            null,
            undefined,
            'chrome-extension',
            'moz-extension',
        ];

        for (const origin of invalidOrigins) {
            const headers = getCorsHeaders(origin);
            expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
        }
    });
});

describe('getReadableError', () => {
    it('returns database initialization message when error message includes "no such table: chats"', () => {
        const error = new Error('D1_ERROR: no such table: chats');
        const message = getReadableError(error);
        expect(message).toBe('Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.');
    });

    it('returns default error message for standard errors', () => {
        const error = new Error('Some unexpected failure');
        const message = getReadableError(error);
        expect(message).toBe('Something went wrong!');
    });

    it('handles non-Error objects and strings gracefully', () => {
        expect(getReadableError('no such table: chats')).toBe('Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.');
        expect(getReadableError('Random string error')).toBe('Something went wrong!');
        expect(getReadableError(12345)).toBe('Something went wrong!');
        expect(getReadableError(null)).toBe('Something went wrong!');
        expect(getReadableError(undefined)).toBe('Something went wrong!');
    });
});
