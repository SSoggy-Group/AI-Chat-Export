import { describe, it, expect } from 'vitest';
import { getCorsHeaders, getReadableError } from '../utils.js';

describe('getCorsHeaders', () => {
    it('returns default headers for any request', () => {
        const headers = getCorsHeaders(undefined);
        expect(headers).toMatchObject({
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
        });
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('sets Access-Control-Allow-Origin for whitelisted origins', () => {
        const allowedOrigins = [
            'https://claude.ai',
            'https://ai.ssoggy.me',
            'http://localhost:4000',
        ];

        allowedOrigins.forEach((origin) => {
            const headers = getCorsHeaders(origin);
            expect(headers['Access-Control-Allow-Origin']).toBe(origin);
        });
    });

    it('sets Access-Control-Allow-Origin for chrome extension origins', () => {
        const origin = 'chrome-extension://abcdefghijklmnopqrstuvwxyz123456';
        const headers = getCorsHeaders(origin);
        expect(headers['Access-Control-Allow-Origin']).toBe(origin);
    });

    it('sets Access-Control-Allow-Origin for firefox extension origins', () => {
        const origin = 'moz-extension://12345678-1234-1234-1234-123456789abc';
        const headers = getCorsHeaders(origin);
        expect(headers['Access-Control-Allow-Origin']).toBe(origin);
    });

    it('does not set Access-Control-Allow-Origin for disallowed origins', () => {
        const disallowedOrigins = [
            'https://malicious-site.com',
            'https://example.com',
            'http://localhost:3000',
            null,
            '',
        ];

        disallowedOrigins.forEach((origin) => {
            const headers = getCorsHeaders(origin);
            expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
        });
    });
});

describe('getReadableError', () => {
    it('returns database initialization message when error contains "no such table: chats"', () => {
        const error = new Error('no such table: chats');
        const message = getReadableError(error);
        expect(message).toBe(
            'Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.'
        );
    });

    it('handles string errors containing "no such table: chats"', () => {
        const error = 'Error: no such table: chats';
        const message = getReadableError(error);
        expect(message).toBe(
            'Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.'
        );
    });

    it('returns fallback message for general Error objects', () => {
        const error = new Error('Some random error');
        const message = getReadableError(error);
        expect(message).toBe('Something went wrong!');
    });

    it('returns fallback message for non-Error types', () => {
        expect(getReadableError(123)).toBe('Something went wrong!');
        expect(getReadableError(null)).toBe('Something went wrong!');
        expect(getReadableError(undefined)).toBe('Something went wrong!');
    });
});
