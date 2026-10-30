// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import BotAvatar, { getBotType, getBotConfig, getBotName } from '../BotAvatar';

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
    it('returns valid config object for known bot sources', () => {
        const claudeConfig = getBotConfig('claude');
        expect(claudeConfig).toEqual({
            name: 'Claude',
            color: '#D97757',
            icon: expect.anything(),
        });

        const chatgptConfig = getBotConfig('chatgpt');
        expect(chatgptConfig).toEqual({
            name: 'ChatGPT',
            color: '#10A37F',
            icon: expect.anything(),
        });

        const userConfig = getBotConfig('user');
        expect(userConfig).toEqual({
            name: 'You',
            color: '#8B8B8B',
            icon: expect.anything(),
        });

        const deepseekConfig = getBotConfig('deepseek');
        expect(deepseekConfig.name).toBe('DeepSeek');
        expect(deepseekConfig.color).toBe('#4D6BFE');

        const geminiConfig = getBotConfig('gemini');
        expect(geminiConfig.name).toBe('Gemini');
        expect(geminiConfig.color).toBe('#1DA1F2');
    });

    it('returns user config for falsy or empty source inputs', () => {
        const userConfig = getBotConfig('user');
        expect(getBotConfig('')).toBe(userConfig);
        expect(getBotConfig(null)).toBe(userConfig);
        expect(getBotConfig(undefined)).toBe(userConfig);
    });

    it('returns claude config as fallback for unknown bot sources', () => {
        const claudeConfig = getBotConfig('claude');
        expect(getBotConfig('unknown-bot')).toBe(claudeConfig);
        expect(getBotConfig('random_model')).toBe(claudeConfig);
    });

    it('ensures all mapped bot sources return configs with required properties', () => {
        const sources = [
            'user', 'human', 'claude', 'assistant', 'chatgpt',
            'deepseek', 'mistral', 'gemini', 'qwen', 'meta',
            'perplexity', 'google'
        ];

        sources.forEach((source) => {
            const config = getBotConfig(source);
            expect(config).toBeDefined();
            expect(typeof config.name).toBe('string');
            expect(config.name.length).toBeGreaterThan(0);
            expect(typeof config.color).toBe('string');
            expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(config.icon).toBeDefined();
        });
    });
});

describe('getBotName', () => {
    it('returns correct name for known bot sources', () => {
        expect(getBotName('claude')).toBe('Claude');
        expect(getBotName('chatgpt')).toBe('ChatGPT');
        expect(getBotName('user')).toBe('You');
        expect(getBotName('deepseek')).toBe('DeepSeek');
        expect(getBotName('mistral')).toBe('LeChat');
    });

    it('returns fallback bot name for unknown or missing sources', () => {
        expect(getBotName('unknown')).toBe('Claude');
        expect(getBotName('')).toBe('You');
        expect(getBotName(null)).toBe('You');
    });
});

describe('BotAvatar component', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders avatar for known bot source with default medium size', () => {
        const { container } = render(<BotAvatar source="claude" />);
        const avatarDiv = container.firstChild;

        expect(avatarDiv).not.toBeNull();
        expect(avatarDiv.getAttribute('title')).toBe('Claude');
        expect(avatarDiv.className).toContain('w-9 h-9');
        expect(avatarDiv.style.color).toBe('#D97757');
    });

    it('renders avatar with custom sizes (sm, md, lg)', () => {
        const { container: containerSm } = render(<BotAvatar source="chatgpt" size="sm" />);
        expect(containerSm.firstChild.className).toContain('w-7 h-7');

        const { container: containerMd } = render(<BotAvatar source="chatgpt" size="md" />);
        expect(containerMd.firstChild.className).toContain('w-9 h-9');

        const { container: containerLg } = render(<BotAvatar source="chatgpt" size="lg" />);
        expect(containerLg.firstChild.className).toContain('w-11 h-11');
    });

    it('renders fallback avatar for unknown source', () => {
        const { container } = render(<BotAvatar source="unknown-model" />);
        const avatarDiv = container.firstChild;

        expect(avatarDiv.getAttribute('title')).toBe('Claude');
    });
});
