// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MarkdownRenderer from '../MarkdownRenderer';

// Mock mermaid module to prevent rendering initialization issues
vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        init: vi.fn()
    }
}));

describe('MarkdownRenderer', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe('Standard Markdown Rendering', () => {
        it('renders plain text and paragraphs correctly', () => {
            render(<MarkdownRenderer content="Hello world, this is a test paragraph." />);
            expect(screen.getByText('Hello world, this is a test paragraph.')).not.toBeNull();
        });

        it('renders markdown formatting like bold, italic, and headers', () => {
            const content = '# Heading 1\n\n**Bold Text** and *Italic Text*';
            const { container } = render(<MarkdownRenderer content={content} />);

            expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).not.toBeNull();
            expect(container.querySelector('strong').textContent).toBe('Bold Text');
            expect(container.querySelector('em').textContent).toBe('Italic Text');
        });

        it('renders links with target="_blank" and rel="noopener noreferrer"', () => {
            const content = '[Example Link](https://example.com)';
            render(<MarkdownRenderer content={content} />);

            const link = screen.getByRole('link', { name: 'Example Link' });
            expect(link.getAttribute('href')).toBe('https://example.com');
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        });

        it('sanitizes javascript: links to prevent XSS', () => {
            const content = '[Malicious Link](javascript:alert(1))';
            render(<MarkdownRenderer content={content} />);

            const link = screen.getByRole('link', { name: 'Malicious Link' });
            expect(link.getAttribute('href')).toBe('#');
        });

        it('renders tables with proper GFM structure and styling', () => {
            const content = `
| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |
`;
            const { container } = render(<MarkdownRenderer content={content} />);

            expect(container.querySelector('table')).not.toBeNull();
            expect(container.querySelector('thead')).not.toBeNull();
            expect(screen.getByText('Header 1')).not.toBeNull();
            expect(screen.getByText('Cell 1')).not.toBeNull();
        });

        it('renders inline code and fenced code blocks using CodeBlock', () => {
            const content = 'Here is `inline code` and a code block:\n\n```js\nconst x = 42;\n```';
            const { container } = render(<MarkdownRenderer content={content} />);

            expect(screen.getByText('inline code')).not.toBeNull();
            expect(screen.getByText('js')).not.toBeNull();
            expect(container.textContent).toContain('const x = 42;');
        });
    });

    describe('Ant Artifact Rendering', () => {
        it('renders application/vnd.ant.mermaid artifact and calls mermaid.init', async () => {
            const mermaidModule = await import('mermaid');
            const artifactContent = `<antArtifact identifier="graph-1" type="application/vnd.ant.mermaid" title="Flowchart">
graph TD;
    A-->B;
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('Flowchart')).not.toBeNull();
            expect(container.querySelector('pre.mermaid')).not.toBeNull();
            expect(container.querySelector('pre.mermaid').textContent).toContain('graph TD;');
            expect(mermaidModule.default.init).toHaveBeenCalledWith(undefined, '.mermaid');
        });

        it('renders application/vnd.ant.react artifact', () => {
            const artifactContent = `<antArtifact identifier="react-comp" type="application/vnd.ant.react" title="React Component">
export default function App() { return <div>Hello</div>; }
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('React Component')).not.toBeNull();
            expect(container.textContent).toContain('export default function App()');
        });

        it('renders text/html artifact', () => {
            const artifactContent = `<antArtifact identifier="html-doc" type="text/html" title="HTML Document">
<h1>Title</h1>
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('HTML Document')).not.toBeNull();
            expect(container.textContent).toContain('<h1>Title</h1>');
        });

        it('renders text/markdown artifact', () => {
            const artifactContent = `<antArtifact identifier="md-doc" type="text/markdown" title="Markdown Doc">
# Inner Markdown Heading
</antArtifact>`;

            render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('Markdown Doc')).not.toBeNull();
            expect(screen.getByRole('heading', { level: 1, name: 'Inner Markdown Heading' })).not.toBeNull();
        });

        it('renders text/plain and text/x-markdown artifacts like text/markdown', () => {
            const plainContent = `<antArtifact identifier="plain-doc" type="text/plain" title="Plain Doc">
Plain content text
</antArtifact>`;

            const { rerender } = render(<MarkdownRenderer content={plainContent} />);
            expect(screen.getByText('Plain Doc')).not.toBeNull();
            expect(screen.getByText('Plain content text')).not.toBeNull();

            const xMdContent = `<antArtifact identifier="xmd-doc" type="text/x-markdown" title="X-Markdown Doc">
X-Markdown content
</antArtifact>`;

            rerender(<MarkdownRenderer content={xMdContent} />);
            expect(screen.getByText('X-Markdown Doc')).not.toBeNull();
            expect(screen.getByText('X-Markdown content')).not.toBeNull();
        });

        it('renders application/vnd.ant.code artifact with specified language', () => {
            const artifactContent = `<antArtifact identifier="code-py" type="application/vnd.ant.code" language="python" title="Python Script">
print("Hello Python")
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('Python Script')).not.toBeNull();
            expect(container.textContent).toContain('print("Hello Python")');
        });

        it('renders application/vnd.ant.code artifact without language using default text', () => {
            const artifactContent = `<antArtifact identifier="code-nolang" type="application/vnd.ant.code" title="Code without lang">
some raw code
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('Code without lang')).not.toBeNull();
            expect(container.textContent).toContain('some raw code');
        });

        it('renders default fallback for unknown artifact type', () => {
            const artifactContent = `<antArtifact identifier="unknown" type="unknown/type" title="Unknown Type">
custom artifact content
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={artifactContent} />);

            expect(screen.getByText('Unknown Type')).not.toBeNull();
            expect(container.textContent).toContain('custom artifact content');
        });

        it('returns null for malformed antArtifact tag missing required attributes', () => {
            const malformedContent = `<antArtifact type="text/html">
missing identifier and title
</antArtifact>`;

            const { container } = render(<MarkdownRenderer content={malformedContent} />);
            expect(container.textContent).toBe('');
        });
    });

    describe('Excerpt Quote Rendering', () => {
        it('renders excerpt quote block when excerpt header is present', () => {
            const excerptText = `excerpt_from_previous_claude_message.txt:\n\nThis is a quoted excerpt from previous message.`;

            const { container } = render(<MarkdownRenderer content={excerptText} />);

            expect(screen.getByText('Quoting')).not.toBeNull();
            expect(screen.getByText('This is a quoted excerpt from previous message.')).not.toBeNull();
            expect(container.querySelector('.border-l-2')).not.toBeNull();
        });
    });

    describe('Mixed Content and Props', () => {
        it('renders mixture of regular markdown text, artifacts, and excerpt quotes', () => {
            const mixedContent = `Introductory text.

excerpt_from_previous_claude_message.txt:

Quoted excerpt content.

<antArtifact identifier="artifact-1" type="text/html" title="HTML Title">
<p>Inside artifact</p>
</antArtifact>

Concluding text.`;

            render(<MarkdownRenderer content={mixedContent} />);

            expect(screen.getByText('Introductory text.')).not.toBeNull();
            expect(screen.getByText('Quoting')).not.toBeNull();
            expect(screen.getByText('Quoted excerpt content.')).not.toBeNull();
            expect(screen.getByText('HTML Title')).not.toBeNull();
            expect(screen.getByText('Concluding text.')).not.toBeNull();
        });

        it('passes isHuman prop down to CodeBlock components', () => {
            const codeContent = '```javascript\nconst a = 1;\n```';
            const { container } = render(<MarkdownRenderer content={codeContent} isHuman={true} />);

            expect(container.textContent).toContain('const a = 1;');
        });
    });
});
