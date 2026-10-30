import { describe, it, expect } from 'vitest';
import { PROD_API_ORIGIN, DEFAULT_PROD_API_ORIGIN } from '../config';

describe('config module', () => {
    it('defines DEFAULT_PROD_API_ORIGIN as https://ai.ssoggy.me', () => {
        expect(DEFAULT_PROD_API_ORIGIN).toBe('https://ai.ssoggy.me');
    });

    it('exports PROD_API_ORIGIN defaulting to DEFAULT_PROD_API_ORIGIN when env var is unset', () => {
        expect(PROD_API_ORIGIN).toBe('https://ai.ssoggy.me');
    });
});
