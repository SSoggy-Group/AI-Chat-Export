import { drizzle } from 'drizzle-orm/d1';
import { chatsSchema } from '../../../database/schema';

export async function onRequestGet() {
    return new Response('welcome to Claudeshare 🚀, powered by React, Drizzle ORM, and D1, running on Cloudflare Workers');
}

export async function onRequestPost(context) {
    const db = drizzle(context.env.DB);
    try {
        const { title, content } = await context.request.json();
        if (!title || typeof title !== 'string' || !title.trim() || title.length > 512) {
            return Response.json({ msg: 'valid title (max 512 chars) is required' }, { status: 400 });
        }

        if (!Array.isArray(content)) {
            return Response.json({ msg: 'content must be an array' }, { status: 400 });
        }

        const sanitizedContent = [];
        for (const item of content) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                return Response.json({ msg: 'content items must be objects' }, { status: 400 });
            }
            if (typeof item.source !== 'string' || !['user', 'claude'].includes(item.source)) {
                return Response.json({ msg: 'content item source must be "user" or "claude"' }, { status: 400 });
            }
            if (typeof item.message !== 'string') {
                return Response.json({ msg: 'content item message must be a string' }, { status: 400 });
            }
            sanitizedContent.push({
                source: item.source,
                message: item.message
            });
        }

        const [newChat] = await db.insert(chatsSchema).values({ title, content: sanitizedContent }).returning()
        return Response.json({
            id: newChat.id,
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating chat:", error);
        return Response.json({ msg: "something went wrong!" }, { status: 500 });
    }
}