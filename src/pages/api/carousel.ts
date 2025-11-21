export const prerender = false;

import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export const config = {
  bodyParser: false,
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

export const PATCH: APIRoute = async ({ request, locals }) => {
  
  try {
    const formData = await request.formData();
    
    const id = formData.get("id")?.toString();
    const title = formData.get("title")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const imageFile = formData.get("image") as File | null;

    const idAsInt = parseInt(id, 10);

    if (!idAsInt || !title || !description) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos (id, title, description)" }), {
        status: 400,
      });
    }

    const dataToUpdate: { title: string; description: string; image?: Buffer } = {
      title,
      description,
    };

    if (imageFile && imageFile.size > 0) {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      dataToUpdate.image = imageBuffer;
    }

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

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const id = data.id;

    const idAsInt = parseInt(id, 10);

    if (!idAsInt) {
      return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
    }

    await prisma.carousel.delete({
      where: { id: idAsInt },
    });

    return new Response(JSON.stringify({ message: "Elemento eliminado del carrusel" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error al eliminar item del carrusel:", error);
    return new Response(JSON.stringify({ error: "No se pudo eliminar el elemento" }), {
      status: 500,
    });
  }
};