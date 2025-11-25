import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export const prerender = false;

// Función para obtener usuarios de la DB
export async function getUsers() {
  // Intentamos obtener usuarios y contar sus relaciones (posts, comentarios)
  const items = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    // Esto intenta contar posts y comentarios si las relaciones existen en tu schema.prisma
    include: {
      _count: {
        select: { 
            posts: true, 
            comments: true 
        }
      }
    }
  });

  // Mapeamos los datos para enviarlos al frontend limpios
  return items.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    discordId: user.discordId,
    createdAt: user.createdAt,
    connected: user.connected ?? false, 
    posts: user._count?.posts ?? 0,
    comments: user._count?.comments ?? 0
  }));
}

// --- METODO GET ---
export const GET: APIRoute = async () => {
  try {
    const safeItems = await getUsers();

    return new Response(JSON.stringify(safeItems), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener los usuarios:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron obtener los datos" }),
      { status: 500 }
    );
  }
};

// --- METODO PATCH (Mantenemos tu lógica de actualización) ---
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const changes = await request.json();

    if (!Array.isArray(changes)) {
      return new Response(
        JSON.stringify({ error: "El body debe ser un array de cambios" }),
        { status: 400 }
      );
    }

    const allowedRoles = ['usuario', 'moderator', 'admin', 'soporte']; // Ajusta según tus roles reales
    
    const updatePromises = changes.map(change => {
      const { userId, newRole } = change;
      // Asegurar que sea número si tu ID en DB es Int, o string si es String
      const userIdParsed = parseInt(userId, 10); 

      if (!userIdParsed || !newRole) {
        throw new Error(`Datos inválidos para el usuario ${userId}`);
      }
      
      return prisma.user.update({
        where: { id: userIdParsed },
        data: { role: newRole },
      });
    });

    await prisma.$transaction(updatePromises);

    return new Response(JSON.stringify({ message: `${changes.length} usuarios actualizados` }), {
      status: 200,
    });

  } catch (error) {
    console.error("Error al actualizar roles:", error);
    return new Response(
      JSON.stringify({ error: "Error interno", details: error instanceof Error ? error.message : "Desconocido" }),
      { status: 500 }
    );
  }
};