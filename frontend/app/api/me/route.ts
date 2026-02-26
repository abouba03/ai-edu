// app/api/me/route.ts
import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

export async function GET() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"
  if (isAuthDisabled) {
    return Response.json({
      name: "Utilisateur local",
      level: "débutant",
      fallback: true,
      authDisabled: true,
    })
  }

  const { userId } = await auth()

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return new Response("User not found", { status: 404 })
    }

    return Response.json({
      name: user.displayName ?? "Inconnu",
      level: user.level ?? "Intermédiaire",
    })
  } catch {
    return Response.json({
      name: "Utilisateur local",
      level: "débutant",
      fallback: true,
    })
  }
}
