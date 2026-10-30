import { describe, it, expect } from 'vitest';
import { getReadableError, getCorsHeaders } from '../utils.js';

describe('utils', () => {
    describe('getReadableError', () => {
        it('should return database initialization message when Error contains "no such table: chats"', () => {
            const error = new Error('D1_ERROR: no such table: chats');
            expect(getReadableError(error)).toBe(
                'Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.'
            );
        });

        it('should return database initialization message when string error contains "no such table: chats"', () => {
            const error = 'no such table: chats';
            expect(getReadableError(error)).toBe(
                'Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.'
            );
        });

        it('should return default error message for generic Error instances', () => {
            const error = new Error('Some random database failure');
            expect(getReadableError(error)).toBe('Something went wrong!');
        });

        it('should return default error message for non-Error object or primitive values', () => {
            expect(getReadableError('Some generic string error')).toBe('Something went wrong!');
            expect(getReadableError({ custom: 'error' })).toBe('Something went wrong!');
            expect(getReadableError(500)).toBe('Something went wrong!');
            expect(getReadableError(null)).toBe('Something went wrong!');
            expect(getReadableError(undefined)).toBe('Something went wrong!');
        });
    });

    describe('getCorsHeaders', () => {
        it('should set Access-Control-Allow-Origin for whitelisted origins', () => {
            const allowed = [
                'https://claude.ai',
                'https://ai.ssoggy.me',
                'http://localhost:4000',
            ];

            for (const origin of allowed) {
                const headers = getCorsHeaders(origin);
                expect(headers['Access-Control-Allow-Origin']).toBe(origin);
                expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
            }
        });

        it('should set Access-Control-Allow-Origin for chrome and firefox extension origins', () => {
            const chromeOrigin = 'chrome-extension://abcdefghijklmnopqrstuvwxyz';
            const mozOrigin = 'moz-extension://12345678-1234-1234-1234-123456789abc';

            expect(getCorsHeaders(chromeOrigin)['Access-Control-Allow-Origin']).toBe(chromeOrigin);
            expect(getCorsHeaders(mozOrigin)['Access-Control-Allow-Origin']).toBe(mozOrigin);
        });

        it('should not set Access-Control-Allow-Origin for unallowed origins', () => {
            const headers = getCorsHeaders('https://malicious-website.com');
            expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
            expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
        });

        it('should handle undefined or null origin safely', () => {
            const headersNull = getCorsHeaders(null);
            expect(headersNull['Access-Control-Allow-Origin']).toBeUndefined();

            const headersUndefined = getCorsHeaders(undefined);
            expect(headersUndefined['Access-Control-Allow-Origin']).toBeUndefined();
        });
    });
});
