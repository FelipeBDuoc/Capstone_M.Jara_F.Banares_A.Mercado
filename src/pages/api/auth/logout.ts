import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma';

export async function GET(context: APIContext) {
  const { cookies, redirect } = context;

  // 1. Leer la cookie antes de borrarla para saber quién se desconecta
  const sessionCookie = cookies.get("session");

  if (sessionCookie) {
    try {
      const sessionData = JSON.parse(sessionCookie.value);
      
      // 2. Actualizar DB: poner connected en false
      if (sessionData.username) {
        await prisma.user.update({
          where: { username: sessionData.username },
          data: { connected: false },
        });
      }
    } catch (error) {
      console.error("Error actualizando estado de desconexión:", error);
      // No detenemos el logout aunque falle la DB
    }
  }

  // 3. Borrar la cookie de sesión
  cookies.delete("session", {
    path: "/",
  });

  // 4. Redirigir al inicio
  return redirect("/", 302);
}