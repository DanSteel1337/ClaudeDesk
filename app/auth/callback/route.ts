import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server" // Use server client for callback

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/dashboard/projects" // Default to projects

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if there's a user session now
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        return NextResponse.redirect(new URL(next, requestUrl.origin))
      }
      // If no session despite successful code exchange (should be rare)
      console.warn("Code exchanged but no session established immediately.")
      // Fallback redirect, middleware should pick up if still no session
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
    // Log error but still try to redirect, maybe user is already logged in or can try again
    console.error("Error exchanging code for session:", error.message)
    // Redirect to an error page or login with an error message
    const errorRedirectUrl = new URL("/login", requestUrl.origin)
    errorRedirectUrl.searchParams.set("error", "auth_callback_failed")
    errorRedirectUrl.searchParams.set("error_description", error.message || "Could not log you in. Please try again.")
    return NextResponse.redirect(errorRedirectUrl)
  } else {
    // If no code, redirect to an error page or login
    console.warn("Auth callback called without a code.")
    const errorRedirectUrl = new URL("/login", requestUrl.origin)
    errorRedirectUrl.searchParams.set("error", "missing_auth_code")
    errorRedirectUrl.searchParams.set("error_description", "Authentication code was missing. Please try again.")
    return NextResponse.redirect(errorRedirectUrl)
  }
}
