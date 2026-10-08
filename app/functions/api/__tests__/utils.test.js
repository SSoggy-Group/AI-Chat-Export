import { describe, it, expect } from 'vitest';
import { getCorsHeaders } from '../utils.js';

describe('getCorsHeaders', () => {
    it('sets Access-Control-Allow-Origin for whitelisted origin', () => {
        const headers = getCorsHeaders('https://claude.ai');
        expect(headers['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    });

    it('does not set Access-Control-Allow-Origin for unapproved web origin', () => {
        const headers = getCorsHeaders('https://malicious.com');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('does not set Access-Control-Allow-Origin for arbitrary chrome-extension origin', () => {
        const headers = getCorsHeaders('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('does not set Access-Control-Allow-Origin for arbitrary moz-extension origin', () => {
        const headers = getCorsHeaders('moz-extension://12345678-1234-1234-1234-123456789abc');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
});
