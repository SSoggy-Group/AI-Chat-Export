import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import MarkdownRenderer from './MarkdownRenderer';

function ThinkingBlock({ content }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!content || !content.trim()) return null;

    return (
        <div className="my-3 rounded-lg border border-dashed border-gray-600/40 overflow-hidden transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
            >
                <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg
                    className="w-3.5 h-3.5 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                </svg>
                <span>Thinking process</span>
                <span className="text-gray-500 ml-auto text-[10px] uppercase tracking-wider">
                    {isExpanded ? 'collapse' : 'expand'}
                </span>
            </button>
            <div
                className={`transition-opacity duration-300 ease-in-out ${
                    isExpanded ? 'opacity-100' : 'hidden opacity-0'
                }`}
            >
                <div className="px-4 pb-3 pt-1 border-t border-gray-700/30">
                    <div className="text-sm text-gray-500 leading-relaxed italic">
                        <MarkdownRenderer content={content} isHuman={false} />
                    </div>
                </div>
            </div>
        </div>
    );
}

ThinkingBlock.propTypes = {
    content: PropTypes.string,
};

export default memo(ThinkingBlock);
