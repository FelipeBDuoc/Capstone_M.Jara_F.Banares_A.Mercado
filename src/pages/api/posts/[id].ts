import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma';

export async function GET(context: APIContext) {
  const id = Number(context.params.id);

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: true,
      media: true,
      comments: {
        include: { author: true }
      },
      reactions: true
    }
  });

  if (!post) {
    return new Response(JSON.stringify({ error: 'Post no encontrado' }), { status: 404 });
  }

  return new Response(JSON.stringify(post), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
