export function getReadableError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('no such table: chats')) {
        return 'Local D1 database is not initialized. Run "npm run db:migrate:local" in /app, then retry.';
    }

    return 'Something went wrong!';
}

const ALLOWED_ORIGINS = [
    'https://claude.ai',
    'https://shareclaude.pages.dev',
    'http://localhost:4000',
];

export function getCorsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
