import { prisma } from "../../../lib/prisma";

export async function GET() {
  const posts = await prisma.post.findMany({
    include: {
      author: true,
      comments: {
        include: {
          author: true
        }
      },
      reactions: true
    },
    orderBy: {
      id: "desc"
    }
  });

  return new Response(JSON.stringify(posts), { status: 200 });
}

Esto devuelve un JSON así:

{
  "id": 1,
  "title": "Hola mundo",
  "content": "Texto",
  "author": { "id": 3, "username": "Mauricio" },
  "comments": [
    { "id": 10, "content": "hola", "author": { "id": 4, "username": "Pedro" } }
  ]
}