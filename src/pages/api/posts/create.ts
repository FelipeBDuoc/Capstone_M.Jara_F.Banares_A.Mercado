import type { APIContext } from "astro";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();


export async function POST({ request, redirect }: APIContext) {
try {
const form = await request.formData();


const title = form.get("title")?.toString();
const content = form.get("content")?.toString();
const authorId = Number(form.get("authorId"));


if (!title || !content || !authorId) {
return new Response("Datos incompletos", { status: 400 });
}


await prisma.post.create({
data: {
title,
content,
authorId,
},
});


return redirect("/foro", 302);
} catch (err) {
console.error("Error creando post:", err);
return new Response("Error creando post", { status: 500 });
}
}