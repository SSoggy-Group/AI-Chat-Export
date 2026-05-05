import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { chatsSchema } from '../../../../database/schema';
import { getReadableError, getCorsHeaders } from '../../utils';

export async function onRequestGet(context) {
    const id = context.params.id;
    const origin = context.request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    try {
        const db = drizzle(context.env.DB);
        const [chat] = await db.select().from(chatsSchema).where(eq(chatsSchema.id, id)).limit(1);
        if (!chat) {
            return new Response('Chat not found', {
                status: 404,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        const messages = Array.isArray(chat.content) ? chat.content : [];
        const lines = [`# ${chat.title}`, ''];

        for (const { source, message } of messages) {
            const role = source === 'user' ? 'You' : 'Claude';
            lines.push(`## ${role}`, '', message ?? '', '', '---', '');
        }

        return new Response(lines.join('\n'), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    } catch (error) {
        console.log('Error getting raw chat:', error);
        return new Response(getReadableError(error), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
