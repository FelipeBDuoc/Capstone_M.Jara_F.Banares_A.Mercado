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