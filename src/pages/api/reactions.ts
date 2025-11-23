import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function POST(context: APIContext) {
  const { username, postId, type } = await context.request.json();

  if (!username || !postId || !type) {
    return new Response(JSON.stringify({ error: 'Faltan datos.' }), { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    user = await prisma.user.create({ data: { username } });
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId: user.id, postId } }
  });

  if (existing) {
    // Quitar reacción
    await prisma.reaction.delete({ where: { id: existing.id } });
    return new Response(
      JSON.stringify({ message: "Reacción eliminada" }),
      { status: 200 }
    );
  }

  const reaction = await prisma.reaction.create({
    data: {
      type,
      userId: user.id,
      postId
    }
  });

  return new Response(JSON.stringify(reaction), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}
