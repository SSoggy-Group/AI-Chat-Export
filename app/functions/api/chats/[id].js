import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { chatsSchema } from '../../../database/schema';
import { getReadableError, getCorsHeaders } from '../utils';

export async function onRequestOptions(context) {
    const origin = context.request.headers.get('Origin');
    return new Response(null, { headers: getCorsHeaders(origin) });
}

export async function onRequestGet(context) {
    const id = context.params.id;
    const origin = context.request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const db = drizzle(context.env.DB);
        const [chat] = await db.select().from(chatsSchema).where(eq(chatsSchema.id, id)).limit(1)
        if (!chat) {
            return Response.json({ msg: 'chat not found' }, { status: 404, headers: corsHeaders });
        }

        return Response.json(chat, { headers: corsHeaders });
    } catch (error) {
        console.log("Error getting a chat: ", error)
        return Response.json({ msg: getReadableError(error) }, { status: 500, headers: corsHeaders });
    }
}