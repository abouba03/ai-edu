export type TrackEventInput = {
  action: string
  feature: string
  status: "success" | "error" | "start"
  metadata?: unknown
}

export async function trackEvent(input: TrackEventInput) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })
  } catch {
    // keep silent: tracking must never break UX
  }
}
