export const prerender = false;

import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export const config = {
  bodyParser: false,
};

// --- 1. POST: CREAR NOTICIA ---
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    
    const title = formData.get("title")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const imageFile = formData.get("image") as File | null;
    
    // <--- NUEVO: Obtenemos las fechas del formulario
    const postDateStr = formData.get("postDate")?.toString();
    const downDateStr = formData.get("downDate")?.toString();

    // Validamos que existan todos los campos obligatorios (Schema: String, String, DateTime, DateTime)
    // Nota: image es opcional en tu schema (Bytes?), pero aquí valido que exista. 
    // Si quieres permitir noticias sin imagen, quita "!imageFile" del if.
    if (!imageFile || !title || !description || !postDateStr || !downDateStr) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
      });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const newItem = await prisma.news.create({
      data: {
        title,
        description,
        image: imageBuffer,
        // <--- NUEVO: Convertimos el string (del input date) a objeto Date
        postDate: new Date(postDateStr),
        downDate: new Date(downDateStr),
      },
    });

    return new Response(JSON.stringify(newItem), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al subir noticia:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
    });
  }
};

// --- 2. FUNCIÓN DE FETCH (GET) ---
export async function getNewsPosts() {
  const items = await prisma.news.findMany({
    orderBy: { postDate: "desc" }, 
  });

  // Mapeamos los datos para el frontend
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    // Devolvemos las fechas formateadas o como objeto, según prefieras en el front
    postDate: item.postDate, 
    downDate: item.downDate,
    imageUrl: item.image ? `data:image/png;base64,${item.image.toString("base64")}` : null,
  }));
}

export const GET: APIRoute = async () => {
  try {
    const safeItems = await getNewsPosts();
    return new Response(JSON.stringify(safeItems), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener noticias:", error);
    return new Response(JSON.stringify({ error: "No se pudieron obtener los datos" }), {
      status: 500,
    });
  }
};

// --- 3. PATCH: ACTUALIZAR NOTICIA ---
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    
    const id = formData.get("id")?.toString();
    const title = formData.get("title")?.toString();      // Puede ser undefined si no se edita
    const description = formData.get("description")?.toString();
    const postDateStr = formData.get("postDate")?.toString();
    const downDateStr = formData.get("downDate")?.toString();
    const imageFile = formData.get("image") as File | null;

    const idAsInt = parseInt(id || "", 10);

    if (!idAsInt) {
      return new Response(JSON.stringify({ error: "Falta el ID" }), { status: 400 });
    }

    // Construimos el objeto de actualización dinámicamente
    // Definimos el tipo para TypeScript basado en tu Schema
    const dataToUpdate: { 
      title?: string; 
      description?: string; 
      postDate?: Date; 
      downDate?: Date; 
      image?: Buffer 
    } = {};

    // Solo agregamos al objeto lo que venga en el formulario
    if (title) dataToUpdate.title = title;
    if (description) dataToUpdate.description = description;
    
    // <--- NUEVO: Si vienen fechas nuevas, las parseamos y agregamos
    if (postDateStr) dataToUpdate.postDate = new Date(postDateStr);
    if (downDateStr) dataToUpdate.downDate = new Date(downDateStr);

    if (imageFile && imageFile.size > 0) {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      dataToUpdate.image = imageBuffer;
    }

    const updatedItem = await prisma.news.update({
      where: { id: idAsInt },
      data: dataToUpdate,
    });

    return new Response(JSON.stringify(updatedItem), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error al actualizar noticia:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Leemos el JSON enviado desde el frontend ({ id: "123" })
    const data = await request.json();
    const id = data.id;

    const idAsInt = parseInt(id, 10);

    if (!idAsInt) {
      return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
    }

    await prisma.news.delete({
      where: { id: idAsInt },
    });

    return new Response(JSON.stringify({ message: "Noticia eliminada" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error al eliminar noticia:", error);
    return new Response(JSON.stringify({ error: "No se pudo eliminar el elemento" }), {
      status: 500,
    });
  }
};