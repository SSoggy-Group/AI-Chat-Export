import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from './index.js';
import { drizzle } from 'drizzle-orm/d1';

vi.mock('drizzle-orm/d1', () => ({
    drizzle: vi.fn()
}));

vi.mock('../../../database/schema', () => ({
    chatsSchema: {}
}));

describe('onRequestPost', () => {
    let mockDb;
    let mockInsert;
    let mockValues;
    let mockReturning;

    beforeEach(() => {
        vi.clearAllMocks();

        mockReturning = vi.fn();
        mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockInsert = vi.fn().mockReturnValue({ values: mockValues });

        mockDb = {
            insert: mockInsert
        };

        drizzle.mockReturnValue(mockDb);
    });

    const createMockContext = (body) => ({
        env: { DB: {} },
        request: {
            json: vi.fn().mockResolvedValue(body)
        }
    });

    it('should create a chat and return 201 with id', async () => {
        const context = createMockContext({ title: 'Test Title', content: [{ source: 'user', message: 'Hello' }] });
        mockReturning.mockResolvedValue([{ id: 'chat-123' }]);

        const response = await onRequestPost(context);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ id: 'chat-123' });
        expect(mockInsert).toHaveBeenCalled();
        expect(mockValues).toHaveBeenCalledWith({ title: 'Test Title', content: [{ source: 'user', message: 'Hello' }] });
    });

    it('should return 400 if title is missing or empty', async () => {
        const context = createMockContext({ title: '   ', content: [{ source: 'user', message: 'Hello' }] });

        const response = await onRequestPost(context);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({ msg: 'valid title (max 512 chars) is required' });
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
        const context = createMockContext({ title: 'Test Title', content: [{ source: 'user', message: 'Hello' }] });
        mockReturning.mockRejectedValue(new Error('DB Error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const response = await onRequestPost(context);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ msg: 'something went wrong!' });

        consoleSpy.mockRestore();
    });
});
