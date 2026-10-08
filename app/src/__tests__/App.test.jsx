// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import App from '../App';

describe('App component', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders home page by default at root path', async () => {
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Share Your AI Chats')).not.toBeNull();
        });

        // Header and Footer should be rendered within Layout
        expect(screen.getByText('AI-Chat-Export')).not.toBeNull();
        expect(screen.getByText('Privacy Policy')).not.toBeNull();
    });

    it('navigates to privacy policy page', async () => {
        window.history.pushState({}, '', '/privacy-policy');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).not.toBeNull();
        });
    });

    it('renders 404 page for unknown routes', async () => {
        window.history.pushState({}, '', '/some-nonexistent-page');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('404 - Page Not Found')).not.toBeNull();
            expect(screen.getByRole('link', { name: 'Go Back to Home' })).not.toBeNull();
        });
    });
});
