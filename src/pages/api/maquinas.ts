import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';


// GET: Obtener todas las configuraciones
export const GET: APIRoute = async () => {
  try {
    // Ordenamos por ID de Proxmox para que sea ordenado
    const servers = await prisma.serverConfig.findMany({
      orderBy: { proxmoxId: 'asc' }
    });
    
    return new Response(JSON.stringify(servers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error interno DB' }), { status: 500 });
  }
};

// PATCH: Guardar cambios masivos
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const updates = await request.json(); // Array de objetos { id, field1, field2... }

    if (!Array.isArray(updates)) {
      return new Response(JSON.stringify({ error: 'Formato inválido' }), { status: 400 });
    }

    // Ejecutamos una transacción para procesar todas las actualizaciones
    // Prisma no tiene un "bulk update" nativo para diferentes valores por fila,
    // así que iteramos dentro de una transacción.
    const transaction = updates.map((updateData) => {
      const { id, ...dataToUpdate } = updateData;
      
      return prisma.serverConfig.update({
        where: { id: Number(id) },
        data: dataToUpdate
      });
    });

    await prisma.$transaction(transaction);

    return new Response(JSON.stringify({ success: true, count: updates.length }), {
      status: 200
    });

  } catch (error) {
    console.error('Error guardando servers:', error);
    return new Response(JSON.stringify({ error: 'Error guardando datos' }), { status: 500 });
  }
};