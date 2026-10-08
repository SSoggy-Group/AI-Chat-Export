// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ChatMessage from '../ChatMessage';

describe('ChatMessage component', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders user message correctly', () => {
        const chat = {
            source: 'user',
            message: 'Hello, how are you?'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article).not.toBeNull();
        expect(article.getAttribute('data-role')).toBe('user');

        expect(screen.getByText('You')).not.toBeNull();
        expect(screen.getByText('Hello, how are you?')).not.toBeNull();
        expect(screen.queryByText('Thinking process')).toBeNull();
    });

    it('renders human message as user role', () => {
        const chat = {
            source: 'human',
            message: 'Message from human'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article.getAttribute('data-role')).toBe('human');
        expect(screen.getByText('You')).not.toBeNull();
        expect(screen.getByText('Message from human')).not.toBeNull();
    });

    it('renders assistant message for Claude', () => {
        const chat = {
            source: 'claude',
            message: 'I am Claude.'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article.getAttribute('data-role')).toBe('claude');
        expect(screen.getByText('Claude')).not.toBeNull();
        expect(screen.getByText('I am Claude.')).not.toBeNull();
    });

    it('renders assistant message for ChatGPT', () => {
        const chat = {
            source: 'chatgpt',
            message: 'I am ChatGPT.'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article.getAttribute('data-role')).toBe('chatgpt');
        expect(screen.getByText('ChatGPT')).not.toBeNull();
        expect(screen.getByText('I am ChatGPT.')).not.toBeNull();
    });

    it('renders assistant message for DeepSeek', () => {
        const chat = {
            source: 'deepseek',
            message: 'DeepSeek reply.'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article.getAttribute('data-role')).toBe('deepseek');
        expect(screen.getByText('DeepSeek')).not.toBeNull();
        expect(screen.getByText('DeepSeek reply.')).not.toBeNull();
    });

    it('renders assistant message for Mistral', () => {
        const chat = {
            source: 'mistral',
            message: 'Mistral reply.'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const article = container.querySelector('article');
        expect(article.getAttribute('data-role')).toBe('mistral');
        expect(screen.getByText('LeChat')).not.toBeNull();
        expect(screen.getByText('Mistral reply.')).not.toBeNull();
    });

    it('renders ThinkingBlock when thinking prop is provided and non-empty', () => {
        const chat = {
            source: 'claude',
            message: 'Final answer.',
            thinking: 'Let me think about this step by step.'
        };

        render(<ChatMessage chat={chat} />);

        const thinkingButton = screen.getByText('Thinking process');
        expect(thinkingButton).not.toBeNull();
        expect(screen.getByText('expand')).not.toBeNull();

        // Expand thinking block
        fireEvent.click(thinkingButton);
        expect(screen.getByText('collapse')).not.toBeNull();
        expect(screen.getByText('Let me think about this step by step.')).not.toBeNull();
    });

    it('does not render ThinkingBlock when thinking prop is missing or empty', () => {
        const chatWithEmptyThinking = {
            source: 'claude',
            message: 'No thinking content.',
            thinking: '   '
        };

        render(<ChatMessage chat={chatWithEmptyThinking} />);

        expect(screen.queryByText('Thinking process')).toBeNull();
    });

    it('renders markdown content such as bold text in message', () => {
        const chat = {
            source: 'claude',
            message: 'This is **bold** text.'
        };

        const { container } = render(<ChatMessage chat={chat} />);

        const strongEl = container.querySelector('strong');
        expect(strongEl).not.toBeNull();
        expect(strongEl.textContent).toBe('bold');
    });
});
