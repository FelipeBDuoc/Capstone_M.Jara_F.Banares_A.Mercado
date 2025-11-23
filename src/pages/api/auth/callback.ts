import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma'; // Ajusta la ruta según donde creaste el archivo anterior

// --- DEFINICIÓN DE TIPOS ---
interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

interface DiscordMember {
  roles: string[];
  user: {
    id: string;
  };
}

interface UserSession {
  id: string;
  username: string;
  avatar: string | null;
  esAdmin: boolean;
}

// --- EL ENDPOINT ---

export async function GET(context: APIContext) {
  const { url, cookies, redirect } = context;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Manejo básico de errores de redirección
  if (error) {
    return redirect(`/?error=${encodeURIComponent(error)}`, 302);
  }
  if (!code) {
    return redirect(`/?error=${encodeURIComponent("No code provided")}`, 302);
  }

  const clientId = import.meta.env.DISCORD_CLIENT_ID;
  const clientSecret = import.meta.env.DISCORD_CLIENT_SECRET;
  const redirectUri = "http://localhost:4321/api/auth/callback";

  try {
    // --- 3. OBTENER TOKENS ---
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    const accessToken = tokenData.access_token;

    // --- 4. OBTENER USUARIO ---
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData: DiscordUser = await userResponse.json();

    console.log("Usuario recibido de Discord:", userData); // Verifica los datos del usuario

    // --- 5. VERIFICAR ROLES (Lógica del Bot) ---
    const BOT_TOKEN = import.meta.env.DISCORD_BOT_TOKEN;
    const SERVER_ID = import.meta.env.MI_SERVIDOR_ID;
    const ADMIN_ROLE_ID = import.meta.env.ID_ROL_ADMIN;

    let esAdmin = false;

    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${SERVER_ID}/members/${userData.id}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    );

    if (memberResponse.ok) {
      const memberData: DiscordMember = await memberResponse.json();
      if (memberData.roles.includes(ADMIN_ROLE_ID)) {
        esAdmin = true;
      }
    }

    const dbRole = esAdmin ? "admin" : "usuario";

    // --- 6. REGISTRAR O ACTUALIZAR EN BASE DE DATOS ---
    try {
      const upsertResult = await prisma.user.upsert({
        where: { 
          discordId: userData.id // Buscamos por discordId, que es único
        },
        update: {
          username: userData.username,  // Actualizamos el username
          connected: true,               // Marcamos como conectado
          role: dbRole,                  // Actualizamos el rol
        },
        create: {
          discordId: userData.id,       // Guardamos el discordId
          username: userData.username,  // Guardamos el username
          role: dbRole,                 // Asignamos el rol
          connected: true,              // Marcamos como conectado
        },
      });

      console.log("Resultado de upsert:", upsertResult); // Log del resultado de upsert
    } catch (dbError) {
      console.error("Error al guardar en la base de datos:", dbError); // Log del error específico de DB
      return new Response("Error en la base de datos", { status: 500 });
    }

    // --- 7. COOKIE Y REDIRECCIÓN ---
    const userToSave: UserSession = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` // Usamos el avatar solo en la cookie
        : null,
      esAdmin: esAdmin,
    };

    cookies.set("session", JSON.stringify(userToSave), {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,  // La cookie expirará en 7 días
    });

    return redirect("/", 302);

  } catch (error) {
    console.error("Error interno en autenticación:", error); // Log completo del error
    return new Response(`Error interno de autenticación: ${error.message}`, { status: 500 });
  }
}
