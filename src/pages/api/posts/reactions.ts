import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { postId, userId, type } = body;

  // 1. Buscar si ya existe una reacción de este usuario en este post
  const existingReaction = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } }
  });

  if (existingReaction) {
    if (existingReaction.type === type) {
      // A. Si es la misma reacción, la quitamos (Toggle off)
      await prisma.reaction.delete({
        where: { id: existingReaction.id }
      });
      return new Response(JSON.stringify({ status: "removed" }));
    } else {
      // B. Si es diferente, la actualizamos (Cambiar reacción)
      await prisma.reaction.update({
        where: { id: existingReaction.id },
        data: { type }
      });
      return new Response(JSON.stringify({ status: "updated" }));
    }
  } else {
    // C. Si no existe, la creamos
    await prisma.reaction.create({
      data: { postId, userId, type }
    });
    return new Response(JSON.stringify({ status: "created" }));
  }
};