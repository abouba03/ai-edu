import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { updateSupabaseSession } from '@/utils/supabase/middleware'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

export default clerkMiddleware(async (auth, req) => {
  const supabaseResponse = await updateSupabaseSession(req)

  if (isAuthDisabled) {
    return supabaseResponse
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  return supabaseResponse
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}