export const prerender = false;

import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export async function getUsers() {
  const items = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Convertimos el buffer de imagen a base64
  return items.map(({ id, username, role, email, discordId, createdAt }) => ({
    id,
    username,
    role,
    email,
    discordId,
    createdAt
  }));
}

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
      {
        status: 500,
      }
    );
  }
};

// ---
// --- MÉTODO PATCH (Actualizado para Aceptar Arrays) ---
// ---
export const PATCH: APROUTE = async ({ request, locals }) => {
  
  // (¡Recuerda poner tu lógica de seguridad aquí!)
  // const session = await locals.auth.validate();
  // if (!session || session.user.role !== 'admin') {
  //   return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  // }

  try {
    const changes = await request.json();

    // 1. Validar que el body sea un array
    if (!Array.isArray(changes)) {
      return new Response(
        JSON.stringify({ error: "El body debe ser un array de cambios" }),
        { status: 400 }
      );
    }

    const allowedRoles = ['user', 'mod', 'admin'];
    
    // 2. Preparar todas las actualizaciones
    const updatePromises = changes.map(change => {
      const { userId, newRole } = change;

      // --- ¡LA MISMA CORRECCIÓN DE ANTES! ---
      const userIdAsInt = parseInt(userId, 10);
      // ------------------------------------

      if (!userIdAsInt || !newRole || !allowedRoles.includes(newRole)) {
        // Si algún cambio es inválido, lanzamos un error que detendrá la transacción
        throw new Error(`Cambio inválido para el usuario ${userId}`);
      }
      
      // Preparamos la promesa de actualización de Prisma
      return prisma.user.update({
        where: { id: userIdAsInt },
        data: { role: newRole },
      });
    });

    // 3. Ejecutar TODAS las actualizaciones en una sola transacción
    //    Esto significa que o TODAS tienen éxito, o NINGUNA se aplica.
    await prisma.$transaction(updatePromises);

    // 4. Responder con éxito
    return new Response(JSON.stringify({ message: `${changes.length} usuarios actualizados` }), {
      status: 200,
    });

  } catch (error) {
    console.error("Error al actualizar roles:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor o datos inválidos", details: error.message }),
      { status: 500 }
    );
  }
};