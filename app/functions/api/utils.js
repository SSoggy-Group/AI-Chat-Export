export function getReadableError(error) {
    console.error('API Error:', error);
    return 'Something went wrong!';
}

const ALLOWED_ORIGINS = [
    'https://claude.ai',
    'https://ai.ssoggy.me',
    'http://localhost:4000',
];

export function getCorsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (ALLOWED_ORIGINS.includes(origin) || origin?.startsWith('chrome-extension://') || origin?.startsWith('moz-extension://')) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
