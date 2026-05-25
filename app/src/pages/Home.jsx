import { Chrome, Globe, Link2, Github } from 'lucide-react';
import { Link } from 'react-router-dom';
import thumbnail from '../assets/thumbnail.webp';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';

const SUPPORTED_BOTS = [
    { name: 'Claude', color: '#D97757', url: 'https://claude.ai' },
    { name: 'ChatGPT', color: '#10A37F', url: 'https://chatgpt.com' },
    { name: 'DeepSeek', color: '#4D6BFE', url: 'https://chat.deepseek.com' },
    { name: 'Mistral', color: '#FF7000', url: 'https://chat.mistral.ai' },
];

function Home() {
    return (
        <div className="min-h-screen overflow-x-hidden text-gray-200">
            <main>
                {/* Hero Section */}
                <div className="max-w-4xl px-4 pt-12 pb-4 mx-auto text-center sm:px-8 sm:pt-20 sm:pb-6">
                    <h1 className="mb-6 text-4xl font-bold sm:text-6xl">
                        Share Your AI Chats
                        <br />
                        <span className="text-aiChatExport-accent">With One Click</span>
                    </h1>
                    <p className="max-w-2xl mx-auto mb-4 text-xl text-gray-400">
                        Instantly share conversations from Claude, ChatGPT, DeepSeek, and Mistral with anyone.
                        A simple browser extension that makes collaboration effortless.
                    </p>

                    {/* Supported bots badges */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        {SUPPORTED_BOTS.map((bot) => (
                            <a
                                key={bot.name}
                                href={bot.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 hover:scale-105"
                                style={{
                                    color: bot.color,
                                    borderColor: `${bot.color}40`,
                                    backgroundColor: `${bot.color}10`,
                                }}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bot.color }} />
                                {bot.name}
                            </a>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <a
                                href="https://chromewebstore.google.com/detail/pcpjdbnjhgofgjgegodlnebdnmiddmaa"
                                target="_blank"
                                className="inline-flex items-center px-6 py-3 text-lg font-semibold text-white rounded-lg bg-aiChatExport-accent hover:bg-aiChatExport-accent/80"
                            >
                                <Chrome className="w-6 h-6 mr-2" />
                                Chrome
                            </a>
                            <a
                                href="https://addons.mozilla.org/firefox/addon/ai-chat-export/"
                                target="_blank"
                                className="inline-flex items-center px-6 py-3 text-lg font-semibold text-white rounded-lg bg-aiChatExport-accent hover:bg-aiChatExport-accent/80"
                            >
                                <Globe className="w-6 h-6 mr-2" />
                                Firefox
                            </a>
                            <Link
                                to="/c/rhxw367ndulkfr24a5hssm5u"
                                className="inline-flex items-center px-6 py-3 text-lg font-semibold border-2 rounded-lg border-aiChatExport-accent text-aiChatExport-accent hover:bg-aiChatExport-accent hover:text-white"
                            >
                                <Link2 className="w-6 h-6 mr-2" />
                                Get Example Link
                            </Link>
                        </div>
                        <p className="text-xs text-gray-400 opacity-75">
                            *Also available for Edge, Brave, Opera and other Chromium-based browsers
                        </p>
                    </div>
                </div>

                {/* YouTube Video */}
                <div className="max-w-4xl px-4 mx-auto mt-0 mb-4 sm:px-8 sm:mb-6">
                    <div className="overflow-hidden transition-all duration-300 border border-gray-600 shadow-lg aspect-video rounded-xl shadow-aiChatExport-accent/50 hover:shadow-aiChatExport-accent/80">
                        <LiteYouTubeEmbed
                            id="fhiBt878T34"
                            thumbnail={thumbnail}
                            title="AI-Chat-Export - Browser Extension for Sharing AI Conversations"
                        />
                    </div>
                </div>

                {/* Feature Card */}
                <div className="pt-1 pb-8">
                    <div className="max-w-4xl px-4 mx-auto sm:px-8">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            <div className="p-6 text-center rounded-lg bg-aiChatExport-backgroundLight">
                                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-lg bg-aiChatExport-background">
                                    <Link2 className="w-6 h-6 text-aiChatExport-accent" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold">One-Click Sharing</h3>
                                <p className="text-gray-400">Share your entire AI conversation with a single click, maintaining all formatting and context.</p>
                            </div>
                            <div className="p-6 text-center rounded-lg bg-aiChatExport-backgroundLight">
                                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-lg bg-aiChatExport-background">
                                    <Chrome className="w-6 h-6 text-aiChatExport-accent" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold">Multi-Bot Support</h3>
                                <p className="text-gray-400">Works with Claude, ChatGPT, DeepSeek, and Mistral Le Chat — all from one extension.</p>
                            </div>
                            <div className="p-6 text-center rounded-lg bg-aiChatExport-backgroundLight">
                                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-lg bg-aiChatExport-background">
                                    <Github className="w-6 h-6 text-aiChatExport-accent" />
                                </div>
                                <h3 className="mb-2 text-xl font-semibold">Open Source</h3>
                                <p className="text-gray-400">Fully open-source and free. Contribute to improve sharing. Available on Chrome, Firefox, and all major browsers.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Home;