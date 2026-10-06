import { describe, it, expect } from 'vitest';
import { getBotType } from '../BotAvatar';

describe('getBotType', () => {
    it('maps user and human sources to user', () => {
        expect(getBotType('user')).toBe('user');
        expect(getBotType('human')).toBe('user');
    });

    it('maps falsy inputs to user', () => {
        expect(getBotType('')).toBe('user');
        expect(getBotType(null)).toBe('user');
        expect(getBotType(undefined)).toBe('user');
    });

    it('maps known assistant sources to their respective bot types', () => {
        expect(getBotType('claude')).toBe('claude');
        expect(getBotType('assistant')).toBe('claude');
        expect(getBotType('chatgpt')).toBe('chatgpt');
        expect(getBotType('deepseek')).toBe('deepseek');
        expect(getBotType('mistral')).toBe('mistral');
        expect(getBotType('gemini')).toBe('gemini');
        expect(getBotType('qwen')).toBe('qwen');
        expect(getBotType('meta')).toBe('meta');
        expect(getBotType('perplexity')).toBe('perplexity');
        expect(getBotType('google')).toBe('google');
    });

    it('falls back to claude for unknown assistant or source types', () => {
        expect(getBotType('unknown-bot')).toBe('claude');
        expect(getBotType('some_other_model')).toBe('claude');
    });
});
