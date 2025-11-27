import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

export const POST: APIRoute = async ({ request, redirect }) => {
  const data = await request.formData();
  const content = data.get("content") as string;
  const postId = Number(data.get("postId"));
  const authorId = Number(data.get("authorId"));

  if (!content || !postId || !authorId) return new Response("Error", { status: 400 });

  await prisma.comment.create({
    data: { content, postId, authorId }
  });

  return redirect("/foro"); // Recarga para ver el comentario
};