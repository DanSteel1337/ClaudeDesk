import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { Database } from "@/types/database" // Ensure this path is correct

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: "", ...options })
        },
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Define public and auth-only routes
  const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"] // Add any other public static pages
  const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"] // Routes for unauthenticated users

  if (!session && !publicRoutes.includes(pathname) && !pathname.startsWith("/api/")) {
    // If no session and trying to access a protected route (not public, not API)
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("next", pathname) // Save intended path
    return NextResponse.redirect(redirectUrl)
  }

  if (session && authRoutes.includes(pathname)) {
    // If session exists and user is trying to access login/signup, redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard/projects", request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
