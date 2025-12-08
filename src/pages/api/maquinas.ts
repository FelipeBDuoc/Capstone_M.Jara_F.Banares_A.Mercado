import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';
import { encrypt } from '../../lib/crypto';

export const GET: APIRoute = async () => {
  try {
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

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const updates = await request.json(); 

    if (!Array.isArray(updates)) {
      return new Response(JSON.stringify({ error: 'Formato inválido' }), { status: 400 });
    }

    const transaction = updates.map((updateData) => {
      const { id, ...dataToUpdate } = updateData;

      if (dataToUpdate.password) {
        dataToUpdate.password = encrypt(dataToUpdate.password);
      }

      if (dataToUpdate.username) {
        dataToUpdate.username = encrypt(dataToUpdate.username);
      }
      
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