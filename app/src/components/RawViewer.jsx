import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBotName } from './BotAvatar';

export function formatChatAsText(chatData) {
    const lines = [`# ${chatData.title}`, ''];
    const messages = Array.isArray(chatData.content) ? chatData.content : [];
    for (const { source, message, thinking } of messages) {
        const role = source === 'user' || source === 'human' ? 'You' : getBotName(source);
        lines.push(`## ${role}`, '');
        if (thinking) {
            lines.push('> **Thinking:**', ...thinking.split('\n').map(l => `> ${l}`), '');
        }
        lines.push(message ?? '', '', '---', '');
    }
    return lines.join('\n');
}

function RawViewer() {
    const { chatId } = useParams();
    const [text, setText] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const apiBase = (import.meta && import.meta.env && import.meta.env.VITE_API_ORIGIN) || '';
                const res = await fetch(`${apiBase}/api/chats/${chatId}`);
                if (!res.ok) {
                    let msg = `HTTP ${res.status}`;
                    try {
                        const errData = await res.json();
                        msg = errData.msg || msg;
                    } catch { /* non-JSON error body */ }
                    throw new Error(msg);
                }
                const data = await res.json();
                document.title = `${data.title} — raw`;
                setText(formatChatAsText(data));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            }
        };
        load();
    }, [chatId]);

    return (
        <div className="min-h-screen bg-[#1a1a2e]">
            <pre className={`mx-auto max-w-[860px] p-8 font-mono text-sm leading-[1.7] whitespace-pre-wrap break-words ${error ? 'text-red-400' : 'text-gray-300'}`}>
                {error ? `Error: ${error}` : (text ?? 'Loading…')}
            </pre>
        </div>
    );
}

export default RawViewer;
