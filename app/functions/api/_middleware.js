const ALLOWED_ORIGINS = [
    'https://claude.ai',
    'https://shareclaude.pages.dev',
    'http://localhost:4000',
];

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');

    const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (ALLOWED_ORIGINS.includes(origin)) {
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
