import { useEffect, useState } from 'react';
import ChatMessage from './ChatMessage';
import BotAvatar, { getBotType, getBotConfig } from './BotAvatar';
import { useParams } from 'react-router-dom';

const PROD_API_ORIGIN = 'https://ai.ssoggy.me';

const BOT_URLS = {
    claude: 'https://claude.ai',
    chatgpt: 'https://chatgpt.com',
    deepseek: 'https://chat.deepseek.com',
    mistral: 'https://chat.mistral.ai',
};

function isLocalDevHost() {
    const { hostname } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function fetchChatFromOrigin(apiOrigin, chatId) {
    const response = await fetch(`${apiOrigin}/api/chats/${chatId}`);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        const body = await response.text();
        throw new Error(body.slice(0, 120) || 'API returned a non-JSON response');
    }

    return await response.json();
}

/** Detect which bot this conversation belongs to */
function detectBotType(content) {
    if (!Array.isArray(content)) return 'claude';
    const botMessage = content.find(
        (m) => m.source && m.source !== 'user' && m.source !== 'human'
    );
    return botMessage ? getBotType(botMessage.source) : 'claude';
}

function ChatViewer() {
    const [chatData, setChatData] = useState(null);
    const [error, setError] = useState(null);
    const { chatId } = useParams();
    const rawHref = isLocalDevHost()
        ? `${PROD_API_ORIGIN}/api/chats/${chatId}/raw`
        : `/api/chats/${chatId}/raw`;

    useEffect(() => {
        const fetchChatData = async () => {
            try {
                const originsToTry = [...new Set(
                    isLocalDevHost()
                        ? [window.location.origin, PROD_API_ORIGIN]
                        : [window.location.origin]
                )];

                let data = null;
                let lastError = null;

                for (const origin of originsToTry) {
                    try {
                        data = await fetchChatFromOrigin(origin, chatId);
                        break;
                    } catch (originError) {
                        lastError = originError;
                    }
                }

                if (!data) {
                    throw lastError ?? new Error('Unable to load chat data');
                }

                const botType = detectBotType(data.content);
                const botConfig = getBotConfig(botType);
                document.title = `${data?.title ?? 'Chat'} — ${botConfig.name} | AI-Chat-Export`;
                setChatData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        };

        fetchChatData();
    }, [chatId]);

    if (error) return (
        <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-red-600">
            Error: {error}
        </div>
    );

    const botType = chatData ? detectBotType(chatData.content) : 'claude';
    const botConfig = chatData ? getBotConfig(botType) : getBotConfig('claude');
    const botUrl = BOT_URLS[botType];

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow w-full max-w-3xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
                {chatData && (
                    <header className="mb-6 text-center">
                        {/* Bot badge */}
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <BotAvatar source={botType} size="lg" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-100">
                            {chatData.title}
                        </h1>
                        <div
                            className="mt-2 h-0.5 w-12 mx-auto rounded-full"
                            style={{ backgroundColor: `${botConfig.color}99` }}
                        />
                        <div className="flex items-center justify-center gap-3 mt-3">
                            <a
                                href={rawHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-gray-400 border border-gray-600/50 rounded hover:border-gray-400/70 hover:text-gray-300 transition-colors"
                                title="Plain text — readable by LLMs and scripts"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
                                raw
                            </a>
                            {botUrl && (
                                <a
                                    href={botUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono border rounded transition-colors"
                                    style={{
                                        color: botConfig.color,
                                        borderColor: `${botConfig.color}40`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = `${botConfig.color}80`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = `${botConfig.color}40`;
                                    }}
                                    title={`Visit ${botConfig.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                                    {botConfig.name}
                                </a>
                            )}
                        </div>
                    </header>
                )}

                <section className="divide-y divide-gray-700/30">
                    {chatData ? (
                        chatData.content.map((chat, index) => (
                            <ChatMessage key={index} chat={chat} />
                        ))
                    ) : (
                        <div className="flex justify-center py-16">
                            <div className="w-10 h-10 border-4 rounded-full border-aiChatExport-accent border-t-transparent animate-spin" />
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default ChatViewer;
