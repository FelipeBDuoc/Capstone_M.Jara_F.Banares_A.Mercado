// src/pages/api/login.ts
import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";

;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, password } = await request.json();

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: "Usuario no encontrado" }),
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ success: false, message: "Contraseña incorrecta" }),
        { status: 401 }
      );
    }

    // Marcar como conectado
    await prisma.user.update({
      where: { username },
      data: { connected: true },
    });

    return new Response(
      JSON.stringify({
        success: true,
        role: user.role,
        username: user.username,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: "Error interno del servidor" }),
      { status: 500 }
    );
  }
};
