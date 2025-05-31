import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { Database } from "@/types/database"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
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

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error('Middleware auth error:', error)
      // Don't redirect on auth errors, let the app handle it
    }

    const { pathname } = request.nextUrl

    // Define route patterns
    const publicRoutes = [
      '/',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/check-email',
      '/contact',
    ]
    
    const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password']
    const apiRoutes = pathname.startsWith('/api/')
    const staticRoutes = pathname.startsWith('/_next/') || 
                        pathname.startsWith('/favicon') ||
                        pathname.includes('.')

    // Skip middleware for static files and API routes
    if (staticRoutes) {
      return response
    }

    // Handle API routes separately (they have their own auth)
    if (apiRoutes) {
      // Only add CORS headers for API routes if needed
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        })
      }
      return response
    }

    // Check if route requires authentication
    const requiresAuth = !publicRoutes.includes(pathname)

    if (!session && requiresAuth) {
      // No session and trying to access protected route
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    if (session && authRoutes.includes(pathname)) {
      // Logged in user trying to access auth pages, redirect to dashboard
      const redirectUrl = new URL('/dashboard/projects', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Handle dashboard root redirect
    if (session && pathname === '/dashboard') {
      const redirectUrl = new URL('/dashboard/projects', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    return response

  } catch (error) {
    console.error('Middleware error:', error)
    
    // On error, allow the request to proceed but log the issue
    // This prevents the entire app from breaking due to middleware issues
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
}
