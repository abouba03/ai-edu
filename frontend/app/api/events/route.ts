import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"

type EventPayload = {
  action: string
  feature: string
  status: string
  metadata?: unknown
}

export async function POST(req: Request) {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"

  let payload: EventPayload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (!payload?.action || !payload?.feature || !payload?.status) {
    return Response.json(
      { ok: false, error: "missing_fields", required: ["action", "feature", "status"] },
      { status: 400 }
    )
  }

  try {
    let clerkId: string | null = null
    let userId: string | null = null

    if (isAuthDisabled) {
      clerkId = "local"
    } else {
      const authData = await auth()
      if (!authData.userId) {
        return new Response("Unauthorized", { status: 401 })
      }
      clerkId = authData.userId

      const user = await prisma.user.findUnique({ where: { clerkId } })
      userId = user?.id ?? null
    }

    await prisma.learningEvent.create({
      data: {
        action: payload.action,
        feature: payload.feature,
        status: payload.status,
        metadata:
          payload.metadata === undefined
            ? Prisma.JsonNull
            : (payload.metadata as Prisma.InputJsonValue),
        clerkId,
        userId,
      },
    })

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "database_error"
    return Response.json({ ok: false, skipped: true, reason: "database_unavailable", detail: message }, { status: 200 })
  }
}

export async function GET(req: Request) {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"

  try {
    let clerkId: string
    if (isAuthDisabled) {
      clerkId = "local"
    } else {
      const authData = await auth()
      if (!authData.userId) {
        return new Response("Unauthorized", { status: 401 })
      }
      clerkId = authData.userId
    }

    const { searchParams } = new URL(req.url)
    const limitParam = Number(searchParams.get("limit") || 10)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 50)) : 10

    const events = await prisma.learningEvent.findMany({
      where: { clerkId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return Response.json({ ok: true, events })
  } catch {
    return Response.json({ ok: true, events: [], fallback: true })
  }
}
