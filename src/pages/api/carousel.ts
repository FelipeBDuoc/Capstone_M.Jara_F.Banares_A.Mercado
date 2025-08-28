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

