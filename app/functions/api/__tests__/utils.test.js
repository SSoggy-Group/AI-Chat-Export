import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReadableError, getCorsHeaders } from '../utils.js';

describe('getReadableError', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('logs error and returns generic message for Error instances', () => {
        const err = new Error('no such table: chats');
        const result = getReadableError(err);

        expect(consoleErrorSpy).toHaveBeenCalledWith('API Error:', err);
        expect(result).toBe('Something went wrong!');
    });

    it('logs error and returns generic message for string errors', () => {
        const err = 'Database connection failed';
        const result = getReadableError(err);

        expect(consoleErrorSpy).toHaveBeenCalledWith('API Error:', err);
        expect(result).toBe('Something went wrong!');
    });
});

describe('getCorsHeaders', () => {
    it('returns allowed origin header for allowed origins', () => {
        const headers = getCorsHeaders('https://claude.ai');
        expect(headers['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    });

    it('does not set Access-Control-Allow-Origin for unauthorized origins', () => {
        const headers = getCorsHeaders('https://malicious-site.com');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
});
