import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';
import '../../../extension/excerpt-utils.js';

const splitOnExcerpts = (text) => globalThis.AIChatExportExcerptUtils.splitTextOnExcerpts(text);

mermaid.initialize({
    startOnLoad: true,
    theme: 'dark'
})

const MarkdownRenderer = ({ content, isHuman }) => {
    const mermaidRef = useRef(null);

    useEffect(() => {
        if (mermaidRef.current) {
            mermaid.init(undefined, '.mermaid');
        }
    }, [content]);

    const parseAntArtifact = (text) => {
        const identifierMatch = text.match(/identifier="([^"]*)"/);
        const typeMatch = text.match(/type="([^"]*)"/);
        const titleMatch = text.match(/title="([^"]*)"/);
        const languageMatch = text.match(/language="([^"]*)"/);

        const contentMatch = text.match(/<antArtifact[^>]*>([\s\S]*?)<\/antArtifact>/);

        if (identifierMatch && typeMatch && titleMatch && contentMatch) {
            return {
                identifier: identifierMatch[1],
                type: typeMatch[1],
                title: titleMatch[1],
                language: languageMatch ? languageMatch[1] : null,
                content: contentMatch[1].trim()
            };
        }
        return null;
    };

    const markdownComponents = {
        code: (props) => <CodeBlock {...props} isHuman={isHuman} />,
        pre: ({ children }) => (
            <div className="overflow-hidden rounded-lg">{children}</div>
        ),
        a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        ),
        table: ({ children }) => (
            <div className="my-4 overflow-x-auto border border-gray-700 rounded-lg">
                <table className="min-w-full border-collapse">{children}</table>
            </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-800/70">{children}</thead>,
        th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-left text-gray-200 border-b border-r border-gray-700 last:border-r-0">{children}</th>
        ),
        td: ({ children }) => (
            <td className="px-3 py-2 text-gray-300 align-top border-b border-r border-gray-700 last:border-r-0">{children}</td>
        ),
        tr: ({ children }) => <tr className="odd:bg-gray-900/40 even:bg-gray-900/10">{children}</tr>
    };

    const renderMarkdown = (content, index, extraClassName = '') => (
        <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            className={`prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-blockquote:border-gray-700 prose-blockquote:text-gray-300 prose-hr:border-gray-700 prose-headings:text-gray-200 prose-li:my-0.5 prose-li:marker:text-gray-500 ${extraClassName}`}
            components={markdownComponents}
        >
            {content}
        </ReactMarkdown>
    );

    const renderArtifact = (artifact, index) => {
        switch (artifact.type) {
            case 'application/vnd.ant.mermaid':
                return (
                    <div key={index} className="my-4" ref={mermaidRef}>
                        <div className="px-4 py-2 text-xs text-gray-200 bg-gray-800">
                            {artifact.title}
                        </div>
                        <div className="p-4 bg-gray-900">
                            <pre className="mermaid">
                                {artifact.content}
                            </pre>
                        </div>
                    </div>
                );

            case 'application/vnd.ant.react':
                return (
                    <CodeBlock
                        key={index}
                        className="language-jsx"
                        isHuman={isHuman}
                        title={artifact.title}
                    >
                        {artifact.content}
                    </CodeBlock>
                );

            case 'text/html':
                return (
                    <CodeBlock
                        key={index}
                        className="language-html"
                        isHuman={isHuman}
                        title={artifact.title}
                    >
                        {artifact.content}
                    </CodeBlock>
                );

            case 'text/markdown':
            case 'text/plain':
            case 'text/x-markdown':
                return (
                    <div key={index} className="my-4">
                        <div className="px-4 py-2 text-xs text-gray-200 bg-gray-800">
                            {artifact.title}
                        </div>
                        <div className="p-4 bg-gray-900">
                            {renderMarkdown(artifact.content)}
                        </div>
                    </div>
                );

            case 'application/vnd.ant.code':
                return (
                    <CodeBlock
                        key={index}
                        className={`language-${artifact.language || 'text'}`}
                        isHuman={isHuman}
                        title={artifact.title}
                    >
                        {artifact.content}
                    </CodeBlock>
                );

            default:
                return (
                    <CodeBlock
                        key={index}
                        className="language-text"
                        isHuman={isHuman}
                        title={artifact.title}
                    >
                        {artifact.content}
                    </CodeBlock>
                );
        }
    };

    const renderExcerpt = (quotedText, key) => (
        <div key={key} className="my-2 pl-3 border-l-2 border-[#D97757] rounded-r-sm bg-black/10">
            <div className="text-xs text-[#D97757] mb-1 font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v6.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 8.28a.75.75 0 0 1 1.06-1.06L7.25 9.19V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" />
                    <path d="M3.5 13.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Z" />
                </svg>
                Quoting
            </div>
            <div className="text-sm text-gray-400">
                {renderMarkdown(quotedText, `${key}-excerpt`, 'prose-p:text-gray-400 prose-headings:text-gray-300 prose-strong:text-gray-300')}
            </div>
        </div>
    );

    const renderPart = (text, index) => {
        const subParts = splitOnExcerpts(text);
        return subParts.map((sub, si) =>
            sub.type === 'excerpt'
                ? renderExcerpt(sub.content, `${index}-${si}`)
                : sub.content.trim()
                    ? renderMarkdown(sub.content, `${index}-${si}`)
                    : null
        );
    };

    const parts = content.split(/(<antArtifact.*?<\/antArtifact>)/s);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('<antArtifact')) {
                    const artifact = parseAntArtifact(part);
                    return artifact ? renderArtifact(artifact, index) : null;
                }
                return renderPart(part, index);
            })}
        </>
    );
};

MarkdownRenderer.propTypes = {
    content: PropTypes.string.isRequired,
    isHuman: PropTypes.bool
};

export default MarkdownRenderer;