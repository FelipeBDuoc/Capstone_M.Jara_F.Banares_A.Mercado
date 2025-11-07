// src/pages/api/auth/login.ts
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  // 1. Define los permisos (scopes) que quieres pedir.
  const scopes = ["identify", "guilds"];

  // 2. Define la URL a la que Discord debe devolver al usuario.
  // ¡DEBE SER EXACTAMENTE LA MISMA que pusiste en el Portal de Discord!
  const redirectUri = "http://localhost:4321/api/auth/callback";

  // 3. Obtenemos el Client ID desde las variables de entorno seguras.
  const clientId = import.meta.env.DISCORD_CLIENT_ID;

  // 4. Construimos la URL de autorización
  const authUrl = `https://discord.com/api/oauth2/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
  }).toString()}`;

  // 5. Redirigimos al usuario a la página de login de Discord
  return context.redirect(authUrl, 302);
}