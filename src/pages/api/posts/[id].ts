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

export async function DELETE({ params }: APIContext) {
  try {
    const id = Number(params.id);

    if (isNaN(id)) {
      return new Response("ID inválido", { status: 400 });
    }

    // Eliminar reacciones
    await prisma.reaction.deleteMany({
      where: { postId: id }
    });

    // Eliminar comentarios
    await prisma.comment.deleteMany({
      where: { postId: id }
    });

    // Eliminar media
    await prisma.media.deleteMany({
      where: { postId: id }
    });

    // Finalmente eliminar el post
    await prisma.post.delete({
      where: { id }
    });

    return new Response("Post eliminado", { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}