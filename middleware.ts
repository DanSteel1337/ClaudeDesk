import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Define public paths that should not be protected by auth
const publicPaths = ["/login", "/signup", "/forgot-password", "/update-password"]
// Define paths for API routes related to auth that should be accessible
const authApiPaths = ["/api/auth/callback"]
// Define paths for static assets and images that should always be allowed
const staticAssetPaths = ["/_next/static", "/_next/image", "/favicon.ico"]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow static assets and images
  if (staticAssetPaths.some((path) => pathname.startsWith(path))) {
    return supabaseResponse
  }

  // Allow auth API paths
  if (authApiPaths.some((path) => pathname.startsWith(path))) {
    return supabaseResponse
  }

  // If user is not authenticated and trying to access a protected route
  if (!user && !publicPaths.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    // Optionally, add a 'redirectedFrom' query param to redirect back after login
    if (pathname !== "/") {
      // Avoid adding redirectedFrom for the root path
      url.searchParams.set("redirectedFrom", pathname)
    }
    return NextResponse.redirect(url)
  }

  // If user is authenticated and trying to access a public auth page (e.g., /login, /signup)
  // Exception for /update-password as user might be logged in via recovery link
  if (user && publicPaths.some((path) => pathname.startsWith(path) && path !== "/update-password")) {
    const url = request.nextUrl.clone()
    url.pathname = "/chat" // Redirect to dashboard
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (example of a truly public API endpoint)
     * - _next/static (static files) - Handled above
     * - _next/image (image optimization files) - Handled above
     * - favicon.ico (favicon file) - Handled above
     * - Specific file extensions for assets
     * This pattern is broad; specific exclusions are better handled inside the middleware.
     */
    "/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
