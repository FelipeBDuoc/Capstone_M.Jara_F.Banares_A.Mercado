// src/pages/api/register.ts
export const prerender = false;

import { prisma } from "../../lib/prisma";
import bcrypt from 'bcryptjs';


export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Username y password son requeridos.' }),
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findUnique({ where: { username } });

    if (userExists) {
      return new Response(
        JSON.stringify({ success: false, message: 'El usuario ya existe.' }),
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'usuario', // solo si no tienes @default en el schema
      },
    });

    return new Response(
      JSON.stringify({ success: true, user: { id: newUser.id, username: newUser.username } }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al registrar:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor.' }),
      { status: 500 }
    );
  }
}
