const ALLOWED_ORIGINS = [
    'https://claude.ai',
    'https://ai.ssoggy.me',
    'http://localhost:4000',
];

const ALLOWED_EXTENSION_IDS = [
    // Add specific extension IDs here if required, e.g. 'chrome-extension://<extension-id>'
];

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');

    const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_EXTENSION_IDS.includes(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
    }

    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders,
            status: 204
        });
    }

    const response = await context.next();
    const newResponse = new Response(response.body, response);

    Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) {
            newResponse.headers.set(key, value);
        }
    });

    return newResponse;
}
