import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma';

export async function POST(context: APIContext) {
  const { username, postId, content } = await context.request.json();

  if (!username || !postId || !content) {
    return new Response(JSON.stringify({ error: 'Faltan datos.' }), { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    user = await prisma.user.create({ data: { username } });
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      authorId: user.id,
      postId
    },
    include: {
      author: true
    }
  });

  return new Response(JSON.stringify(comment), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}
