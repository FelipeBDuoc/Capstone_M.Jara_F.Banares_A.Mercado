// src/pages/api/auth/callback.ts
import type { APIContext } from 'astro';

// --- DEFINICIÓN DE TIPOS ---

// La información que obtenemos del usuario (con su access_token)
interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

// La información que obtenemos del BOT (con el BOT_TOKEN)
// Nos dice los roles del usuario EN NUESTRO SERVIDOR
interface DiscordMember {
  roles: string[]; // Un array de IDs de rol
  user: {
    id: string;
  };
  // ...hay muchos más campos, pero 'roles' es el que nos importa
}

// Lo que guardaremos en nuestra cookie de sesión
interface UserSession {
  id: string;
  username: string;
  avatar: string | null;
  esAdmin: boolean; // ¡El nuevo campo!
}

// --- EL ENDPOINT ---

export async function GET(context: APIContext) {
  const { url, cookies, redirect } = context;

  // --- 1. OBTENER EL CÓDIGO DE DISCORD ---
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("No se recibió el código de Discord", { status: 400 });
  }

  // --- 2. OBTENER VARIABLES DE ENTORNO ---
  const clientId = import.meta.env.DISCORD_CLIENT_ID;
  const clientSecret = import.meta.env.DISCORD_CLIENT_SECRET;
  const redirectUri = "http://localhost:4321/api/auth/callback"; // ¡Asegúrate de que coincida!

  try {
    // --- 3. INTERCAMBIAR 'code' POR 'access_token' (AUTENTICACIÓN DE USUARIO) ---
    // Esto lo hacemos para probar que el USUARIO es quien dice ser.
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
    if (tokenData.error) {
      throw new Error(`Error con el token: ${tokenData.error_description}`);
    }
    
    const accessToken = tokenData.access_token;

    // --- 4. OBTENER INFO DEL USUARIO (con el access_token del usuario) ---
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData: DiscordUser = await userResponse.json();

    // --- 5. VERIFICAR ROLES EN NUESTRO SERVIDOR (AUTENTICACIÓN DE BOT) ---
    // Ahora usamos nuestro BOT para ver qué roles tiene este usuario
    // EN NUESTRO SERVIDOR.
    const BOT_TOKEN = import.meta.env.DISCORD_BOT_TOKEN;
    const SERVER_ID = import.meta.env.MI_SERVIDOR_ID;
    const ADMIN_ROLE_ID = import.meta.env.ID_ROL_ADMIN;

    let esAdmin = false; // Por defecto, no es admin

    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${SERVER_ID}/members/${userData.id}`,
      {
        headers: {
          // Usamos el BOT_TOKEN, no el access_token del usuario
          Authorization: `Bot ${BOT_TOKEN}`,
        },
      }
    );

    if (memberResponse.ok) {
      // El usuario SÍ está en nuestro servidor
      const memberData: DiscordMember = await memberResponse.json();
      
      // Comprobamos si el array de roles del miembro incluye nuestro ID de rol admin
      if (memberData.roles.includes(ADMIN_ROLE_ID)) {
        esAdmin = true;
      }
    } else {
      // El usuario no está en nuestro servidor, o el bot no tiene permisos
      // (Asegúrate de que el "SERVER MEMBERS INTENT" esté activado)
      console.warn(`No se pudo encontrar al miembro ${userData.id} en el servidor ${SERVER_ID}.`);
    }

    // --- 6. PREPARAR Y GUARDAR LA SESIÓN EN UNA COOKIE ---
    const userToSave: UserSession = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar 
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` 
        : null,
      esAdmin: esAdmin, // ¡Guardamos su estado de admin!
    };

    cookies.set("session", JSON.stringify(userToSave), {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 semana
    });

    // --- 7. REDIRIGIR AL USUARIO ---
    return redirect("/", 302); // ¡Logrado!

  } catch (error) {
    console.error("Error catastrófico en el callback de Discord:", error);
    return new Response("Hubo un error al iniciar sesión.", { status: 500 });
  }
}