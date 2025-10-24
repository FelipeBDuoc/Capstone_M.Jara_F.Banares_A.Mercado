export const prerender = false;

import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export const config = {
  bodyParser: false, // necesario para manejar FormData
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const title = formData.get("title")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const imageFile = formData.get("image") as File | null;

    if (!imageFile || !title || !description) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
      });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const newItem = await prisma.carousel.create({
      data: {
        title,
        description,
        image: imageBuffer,
      },
    });

    return new Response(JSON.stringify(newItem), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error al subir imagen:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
    });
  }
};

export async function getCarouselItems() {
  const items = await prisma.carousel.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Convertimos el buffer de imagen a base64
  return items.map(({ id, title, description, image, createdAt }) => ({
    id,
    title,
    description,
    createdAt,
    imageUrl: image ? `data:image/png;base64,${image.toString("base64")}` : null,
  }));
}

export const GET: APIRoute = async () => {
  try {
    const safeItems = await getCarouselItems();

    return new Response(JSON.stringify(safeItems), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener elementos del carrusel:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron obtener los datos" }),
      {
        status: 500,
      }
    );
  }
};

// ... (tu 'export const prerender = false', 'import', 'config', 'POST' y 'GET' se quedan igual) ...

// ---
// --- 🔥 ¡NUEVO MÉTODO PATCH! 🔥 ---
// ---
export const PATCH: APIRoute = async ({ request, locals }) => {
  // (Aquí deberías añadir tu lógica de seguridad para validar que es un admin)
  
  try {
    const formData = await request.formData();
    
    // 1. Obtenemos los datos del formulario
    const id = formData.get("id")?.toString();
    const title = formData.get("title")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const imageFile = formData.get("image") as File | null;

    // --- ¡CORRECCIÓN DE ID! ---
    // El ID vendrá del formulario como string, lo convertimos a número
    const idAsInt = parseInt(id, 10);

    if (!idAsInt || !title || !description) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos (id, title, description)" }), {
        status: 400,
      });
    }

    // 2. Preparamos los datos para Prisma
    // (Asegúrate de que 'title' y 'description' sean 'string' y no 'any')
    const dataToUpdate: { title: string; description: string; image?: Buffer } = {
      title,
      description,
    };

    // 3. ¿El usuario subió una NUEVA imagen?
    // Si 'imageFile' existe y tiene un tamaño (no es un campo vacío)
    if (imageFile && imageFile.size > 0) {
      // Si sí, la convertimos a Buffer y la añadimos a los datos
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      dataToUpdate.image = imageBuffer;
    }
    // Si no subió una nueva imagen, simplemente no se añade al objeto
    // y Prisma NO actualizará el campo 'image', conservando la antigua.

    // 4. Actualizamos en la base de datos
    const updatedItem = await prisma.carousel.update({
      where: {
        id: idAsInt,
      },
      data: dataToUpdate,
    });

    return new Response(JSON.stringify(updatedItem), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error al actualizar item:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
    });
  }
};