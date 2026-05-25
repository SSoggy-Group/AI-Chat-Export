import { memo } from 'react'
import PropTypes from 'prop-types';
import MarkdownRenderer from './MarkdownRenderer';
import BotAvatar, { getBotType, getBotConfig } from './BotAvatar';
import ThinkingBlock from './ThinkingBlock';

function ChatMessage({ chat }) {
    const isUser = chat.source === 'user' || chat.source === 'human';
    const botType = getBotType(chat.source);
    const config = getBotConfig(chat.source);

    return (
        <article className="py-5" data-role={chat.source}>
            <div className="flex items-start gap-3">
                <BotAvatar source={chat.source} />
                <div className="flex-1 min-w-0">
                    <div
                        className="text-xs font-semibold tracking-wide uppercase mb-2"
                        style={{ color: isUser ? '#9CA3AF' : config.color }}
                    >
                        {config.name}
                    </div>
                    {/* Thinking block (for bots that expose reasoning) */}
                    {chat.thinking && <ThinkingBlock content={chat.thinking} />}
                    <div
                        className="rounded-xl px-5 py-4"
                        style={{
                            backgroundColor: isUser ? '#21201C' : `${config.color}08`,
                            borderWidth: '1px',
                            borderColor: isUser
                                ? 'rgba(100,100,100,0.3)'
                                : `${config.color}20`,
                        }}
                    >
                        <div className="break-words">
                            <MarkdownRenderer
                                content={chat.message}
                                isHuman={isUser}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

ChatMessage.propTypes = {
    chat: PropTypes.shape({
        source: PropTypes.string,
        message: PropTypes.string,
        thinking: PropTypes.string,
    }).isRequired,
};

export default memo(ChatMessage);
