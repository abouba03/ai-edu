// app/api/sync-user/route.ts

import prisma from "@/lib/prisma"
import { auth, currentUser } from "@clerk/nextjs/server"

export async function POST() {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"
  let userId: string | null = null
  let user: Awaited<ReturnType<typeof currentUser>> = null

  try {
    const authData = await auth()
    userId = authData.userId ?? null
    user = await currentUser()
  } catch {
    userId = null
    user = null
  }

  if (!userId || !user) {
    if (isAuthDisabled) {
      return Response.json({ ok: true, skipped: true, reason: "auth_disabled_no_session" })
    }
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const email = user.emailAddresses[0]?.emailAddress
    if (!email) {
      return Response.json({ ok: false, skipped: true, reason: "missing_email" }, { status: 200 })
    }

    await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        email,
        displayName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "",
      },
      create: {
        clerkId: userId,
        email,
        displayName: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "",
      },
    })

    return new Response("OK")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error"

    return Response.json(
      {
        ok: false,
        skipped: true,
        reason: "database_unavailable",
        detail: message,
      },
      { status: 200 }
    )
  }
}
