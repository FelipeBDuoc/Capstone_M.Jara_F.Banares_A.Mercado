import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma';

export async function POST(context: APIContext) {
  const { username } = await context.request.json();

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
