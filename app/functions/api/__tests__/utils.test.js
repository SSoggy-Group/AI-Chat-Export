import { describe, it, expect } from 'vitest';
import { getCorsHeaders } from '../utils.js';

describe('getCorsHeaders', () => {
    it('should allow whitelisted origin', () => {
        const headers = getCorsHeaders('https://claude.ai');
        expect(headers['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    });

    it('should reject arbitrary chrome-extension origin', () => {
        const headers = getCorsHeaders('chrome-extension://abcdefghijklmnopqrstuvwxyz123456');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should reject arbitrary moz-extension origin', () => {
        const headers = getCorsHeaders('moz-extension://12345678-1234-1234-1234-123456789abc');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should reject unlisted website origin', () => {
        const headers = getCorsHeaders('https://evil.com');
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
});
