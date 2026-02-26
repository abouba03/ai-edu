import prisma from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

type LearningEvent = {
  action: string
  feature: string
  status: string
  createdAt: string | Date
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
    const limitParam = Number(searchParams.get("limit") || 100)
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 1000)) : 100

    const events: LearningEvent[] = await (prisma as any).learningEvent.findMany({
      where: { clerkId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        action: true,
        feature: true,
        status: true,
        createdAt: true,
      },
    })

    const byStatus = events.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})

    const byFeature = events.reduce<Record<string, number>>((acc, item) => {
      acc[item.feature] = (acc[item.feature] || 0) + 1
      return acc
    }, {})

    const byAction = events.reduce<Record<string, number>>((acc, item) => {
      acc[item.action] = (acc[item.action] || 0) + 1
      return acc
    }, {})

    const started = byStatus.start || 0
    const succeeded = byStatus.success || 0
    const failed = byStatus.error || 0
    const completionRate = started > 0 ? Number(((succeeded / started) * 100).toFixed(1)) : null
    const errorRate = started > 0 ? Number(((failed / started) * 100).toFixed(1)) : null

    return Response.json({
      ok: true,
      sampleSize: events.length,
      kpis: {
        started,
        succeeded,
        failed,
        completionRate,
        errorRate,
      },
      breakdown: {
        byStatus,
        byFeature,
        byAction,
      },
    })
  } catch {
    return Response.json({
      ok: true,
      sampleSize: 0,
      kpis: {
        started: 0,
        succeeded: 0,
        failed: 0,
        completionRate: null,
        errorRate: null,
      },
      breakdown: {
        byStatus: {},
        byFeature: {},
        byAction: {},
      },
      fallback: true,
    })
  }
}
