import { getCorsHeaders } from './utils';

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders,
            status: 204
        });
    }

    const response = await context.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) {
            response.headers.set(key, value);
        }
    });

    return response;
}
