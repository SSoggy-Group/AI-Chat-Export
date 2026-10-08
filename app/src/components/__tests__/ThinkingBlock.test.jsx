// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ThinkingBlock from '../ThinkingBlock';

describe('ThinkingBlock component', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders null when content is missing, empty, or whitespace-only', () => {
        const { container: container1 } = render(<ThinkingBlock content={null} />);
        expect(container1.firstChild).toBeNull();
        cleanup();

        const { container: container2 } = render(<ThinkingBlock content={undefined} />);
        expect(container2.firstChild).toBeNull();
        cleanup();

        const { container: container3 } = render(<ThinkingBlock content="" />);
        expect(container3.firstChild).toBeNull();
        cleanup();

        const { container: container4 } = render(<ThinkingBlock content="   " />);
        expect(container4.firstChild).toBeNull();
        cleanup();

        const { container: container5 } = render(<ThinkingBlock content={`   \n\t  `} />);
        expect(container5.firstChild).toBeNull();
        cleanup();
    });

    it('renders collapsed state initially when valid content is provided', () => {
        const content = 'Analyzing user prompt...';
        const { container } = render(<ThinkingBlock content={content} />);

        // Header text and button
        expect(screen.getByText('Thinking process')).not.toBeNull();
        expect(screen.getByText('expand')).not.toBeNull();

        // Content text should be in DOM
        expect(screen.getByText('Analyzing user prompt...')).not.toBeNull();

        // Collapsed container has 'hidden' and 'opacity-0'
        const expandableContainer = container.querySelector('div.my-3 > div');
        expect(expandableContainer.className).toContain('hidden');
        expect(expandableContainer.className).toContain('opacity-0');
    });

    it('toggles expansion state when the toggle button is clicked', () => {
        const content = 'Step 1: Process logic.';
        const { container } = render(<ThinkingBlock content={content} />);

        const button = screen.getByRole('button');
        const expandableContainer = container.querySelector('div.my-3 > div');
        const chevronSvg = container.querySelector('svg');

        // Initially collapsed
        expect(screen.getByText('expand')).not.toBeNull();
        expect(expandableContainer.className).toContain('hidden');
        expect(chevronSvg.className).not.toContain('rotate-90');

        // First click: expand
        fireEvent.click(button);

        expect(screen.getByText('collapse')).not.toBeNull();
        expect(screen.queryByText('expand')).toBeNull();
        expect(expandableContainer.className).not.toContain('hidden');
        expect(expandableContainer.className).toContain('opacity-100');
        expect(chevronSvg.className).toContain('rotate-90');

        // Second click: collapse
        fireEvent.click(button);

        expect(screen.getByText('expand')).not.toBeNull();
        expect(screen.queryByText('collapse')).toBeNull();
        expect(expandableContainer.className).toContain('hidden');
        expect(expandableContainer.className).toContain('opacity-0');
        expect(chevronSvg.className).not.toContain('rotate-90');
    });

    it('renders markdown formatted content correctly within MarkdownRenderer', () => {
        const markdownContent = '**Bold step** and *italic thought*';
        render(<ThinkingBlock content={markdownContent} />);

        const boldElement = screen.getByText('Bold step');
        expect(boldElement.tagName).toBe('STRONG');

        const italicElement = screen.getByText('italic thought');
        expect(italicElement.tagName).toBe('EM');
    });
});
