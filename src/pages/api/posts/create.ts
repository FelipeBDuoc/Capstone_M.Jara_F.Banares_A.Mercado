import type { APIContext } from "astro";
import { prisma } from "../../../lib/prisma";
import { MediaType } from "@prisma/client"; // Importamos el Enum de Prisma
import fs from "node:fs";
import path from "node:path";

export async function POST({ request, redirect }: APIContext) {
  try {
    const form = await request.formData();

    const title = form.get("title")?.toString();
    const content = form.get("content")?.toString();
    const authorId = Number(form.get("authorId"));
    
    // Obtenemos todos los archivos del input "media"
    const mediaFiles = form.getAll("media") as File[];

    if (!title || !content || !authorId) {
      return new Response("Datos incompletos", { status: 400 });
    }

    // 1. Crear el Post primero para obtener su ID
    const newPost = await prisma.post.create({
      data: {
        title,
        content,
        authorId,
      },
    });

    // 2. Procesar los archivos si existen
    if (mediaFiles && mediaFiles.length > 0) {
      
      // Definir directorio de subida: carpeta "public/uploads" en la raíz del proyecto
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      // Si la carpeta no existe, la creamos
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of mediaFiles) {
        // Ignorar si el archivo está vacío (a veces pasa con inputs file vacíos)
        if (file.size === 0) continue;

        // A. Guardar archivo en disco
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Generar nombre único para evitar sobrescribir (timestamp + nombre original sanitizado)
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.writeFileSync(filePath, buffer);

        // B. Determinar tipo (PHOTO o VIDEO) según el MIME type
        const type = file.type.startsWith("video") ? MediaType.VIDEO : MediaType.PHOTO;

        // C. Guardar referencia en la base de datos
        await prisma.media.create({
          data: {
            url: `/uploads/${fileName}`, // URL pública accesible
            type: type,
            postId: newPost.id,
          },
        });
      }
    }

    return redirect("/foro", 302);
  } catch (err) {
    console.error("Error creando post:", err);
    return new Response("Error creando post", { status: 500 });
  }
}