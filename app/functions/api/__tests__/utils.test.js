import { describe, it, expect } from 'vitest';
import { getReadableError } from '../utils.js';

describe('getReadableError', () => {
    it('returns local D1 database message when error instance contains "no such table: chats"', () => {
        const error = new Error('D1_ERROR: no such table: chats');
        const result = getReadableError(error);
        expect(result).toBe('Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.');
    });

    it('returns generic error message for generic Error instance', () => {
        const error = new Error('Some unexpected database error');
        const result = getReadableError(error);
        expect(result).toBe('Something went wrong!');
    });

    it('returns local D1 database message when non-Error string contains "no such table: chats"', () => {
        const errorString = 'Error: no such table: chats';
        const result = getReadableError(errorString);
        expect(result).toBe('Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.');
    });

    it('returns generic error message for generic non-Error values', () => {
        expect(getReadableError('Random failure string')).toBe('Something went wrong!');
        expect(getReadableError(12345)).toBe('Something went wrong!');
        expect(getReadableError(null)).toBe('Something went wrong!');
        expect(getReadableError(undefined)).toBe('Something went wrong!');
        expect(getReadableError({ key: 'value' })).toBe('Something went wrong!');
    });
});
