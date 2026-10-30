import { describe, it, expect } from 'vitest';
import { getBotType, getBotConfig, getBotName } from '../BotAvatar';

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

describe('getBotConfig', () => {
    it('returns configuration object for known bot sources', () => {
        const sources = [
            { source: 'claude', name: 'Claude', color: '#D97757' },
            { source: 'chatgpt', name: 'ChatGPT', color: '#10A37F' },
            { source: 'deepseek', name: 'DeepSeek', color: '#4D6BFE' },
            { source: 'mistral', name: 'LeChat', color: '#FF7000' },
            { source: 'gemini', name: 'Gemini', color: '#1DA1F2' },
            { source: 'qwen', name: 'Qwen', color: '#615ced' },
            { source: 'meta', name: 'Meta AI', color: '#0668E1' },
            { source: 'perplexity', name: 'Perplexity', color: '#22B8CD' },
            { source: 'google', name: 'Google AI', color: '#4285F4' },
            { source: 'user', name: 'You', color: '#8B8B8B' },
        ];

        sources.forEach(({ source, name, color }) => {
            const config = getBotConfig(source);
            expect(config).toBeDefined();
            expect(config.name).toBe(name);
            expect(config.color).toBe(color);
            expect(config.icon).toBeDefined();
        });
    });

    it('handles aliases correctly', () => {
        const humanConfig = getBotConfig('human');
        expect(humanConfig.name).toBe('You');

        const assistantConfig = getBotConfig('assistant');
        expect(assistantConfig.name).toBe('Claude');
    });

    it('handles falsy inputs by defaulting to user config', () => {
        expect(getBotConfig('')).toEqual(getBotConfig('user'));
        expect(getBotConfig(null)).toEqual(getBotConfig('user'));
        expect(getBotConfig(undefined)).toEqual(getBotConfig('user'));
    });

    it('falls back to claude config for unknown bot sources', () => {
        const unknownConfig = getBotConfig('unknown_source');
        expect(unknownConfig).toEqual(getBotConfig('claude'));
        expect(unknownConfig.name).toBe('Claude');
    });
});

describe('getBotName', () => {
    it('returns the correct bot name for given sources', () => {
        expect(getBotName('user')).toBe('You');
        expect(getBotName('human')).toBe('You');
        expect(getBotName('claude')).toBe('Claude');
        expect(getBotName('assistant')).toBe('Claude');
        expect(getBotName('chatgpt')).toBe('ChatGPT');
    });

    it('returns default bot name for unknown sources or falsy inputs', () => {
        expect(getBotName('unknown_bot')).toBe('Claude');
        expect(getBotName('')).toBe('You');
        expect(getBotName(null)).toBe('You');
        expect(getBotName(undefined)).toBe('You');
    });
});
