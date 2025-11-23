import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

// ===========================================================
// GET /api/posts → devuelve posts completos SIN undefined
// ===========================================================
export const GET: APIRoute = async () => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: true,
        comments: {
          include: {
            author: true
          }
        },
        reactions: true,
        media: true
      }
    });

    // 🔥 Normalizar la estructura
    const normalized = posts.map((p) => ({
      ...p,
      comments: p.comments ?? [],
      reactions: p.reactions ?? [],
      media: p.media ?? [],
      author: p.author ?? { username: "Usuario desconocido" }
    }));

    return new Response(JSON.stringify(normalized), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Error GET /api/posts:", err);
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
};

// ===========================================================
// POST /api/posts → crear nuevo post
// Usa login por Discord y toma ID real del usuario
// ===========================================================
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const sessionCookie = cookies.get("session");

    if (!sessionCookie) {
      return new Response("No autorizado", { status: 401 });
    }

    let session;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch (err) {
      console.error("Cookie inválida:", err);
      return new Response("Cookie inválida", { status: 400 });
    }

    const discordId = session.id; // 🔥 ID real del usuario de Discord

    // Buscar usuario en BD
    const dbUser = await prisma.user.findUnique({
      where: { discordId }
    });

    if (!dbUser) {
      return new Response("Usuario no registrado", { status: 401 });
    }

    // Leer body JSON
    const { title, content } = await request.json();

    if (!title || !content) {
      return new Response("Faltan campos", { status: 400 });
    }

    // Crear post con el autor correcto
    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId: dbUser.id
      },
      include: {
        author: true
      }
    });

    return new Response(JSON.stringify(post), {
      headers: { "Content-Type": "application/json" },
      status: 201
    });

  } catch (err) {
    console.error("Error creando post:", err);
    return new Response("Error interno", { status: 500 });
  }
};
