// src/pages/api/auth/logout.ts
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const { cookies, redirect } = context;

  // 1. Borrar la cookie de sesión
  cookies.delete("session", {
    path: "/",
  });

  // 2. Redirigir al inicio
  return redirect("/", 302);
}