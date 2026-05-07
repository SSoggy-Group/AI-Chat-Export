import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestGet } from '../[id].js';
import * as drizzleD1 from 'drizzle-orm/d1';

vi.mock('drizzle-orm/d1', () => ({
    drizzle: vi.fn()
}));

describe('chats/[id].js onRequestGet', () => {
    let mockContext;
    let mockDb;
    let consoleLogSpy;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn()
        };

        drizzleD1.drizzle.mockReturnValue(mockDb);

        mockContext = {
            params: { id: 'test-id' },
            env: { DB: {} },
            request: {
                headers: new Headers([['Origin', 'https://claude.ai']])
            }
        };

        vi.stubGlobal('Response', {
            json: vi.fn().mockImplementation((data, init) => ({ data, init }))
        });

        consoleLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('returns 200 with chat data when chat is found', async () => {
        const mockChat = { id: 'test-id', title: 'Test Chat' };
        mockDb.limit.mockResolvedValue([mockChat]);

        const response = await onRequestGet(mockContext);

        expect(global.Response.json).toHaveBeenCalledWith(
            mockChat,
            expect.objectContaining({
                headers: expect.any(Object)
            })
        );
        expect(response.data).toEqual(mockChat);
    });

    it('returns 404 when chat is not found', async () => {
        mockDb.limit.mockResolvedValue([]); // returns an empty array

        const response = await onRequestGet(mockContext);

        expect(global.Response.json).toHaveBeenCalledWith(
            { msg: 'chat not found' },
            expect.objectContaining({
                status: 404,
                headers: expect.any(Object)
            })
        );
        expect(response.init.status).toBe(404);
    });

    it('returns 500 when database throws an error', async () => {
        const error = new Error('Database error');
        mockDb.limit.mockRejectedValue(error);

        const response = await onRequestGet(mockContext);

        // It doesn't log anymore.
        // expect(consoleLogSpy).toHaveBeenCalledWith("Error getting a chat: ", error);

        expect(global.Response.json).toHaveBeenCalledWith(
            { msg: 'Something went wrong!' },
            expect.objectContaining({
                status: 500,
                headers: expect.any(Object)
            })
        );
        expect(response.init.status).toBe(500);
    });
});
