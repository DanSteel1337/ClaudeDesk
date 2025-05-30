import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // The 'next' param might be used to redirect to a specific page after confirmation
  const next = searchParams.get("next") ?? "/chat" // Default to /chat after successful auth

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Successfully exchanged code for session
      return NextResponse.redirect(`${origin}${next}`)
    }
    // Log the error for debugging
    console.error("Auth callback error (exchangeCodeForSession):", error.message)
    // Redirect to login with a more specific error if possible, or a generic one
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_exchange_failed&message=${encodeURIComponent(error.message)}`,
    )
  }

  // If no code is present, it might be an OAuth error or direct access
  const errorParam = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (errorParam) {
    console.error(`Auth callback error (params): ${errorParam} - ${errorDescription}`)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}&message=${encodeURIComponent(errorDescription || "An error occurred during authentication.")}`,
    )
  }

  // Fallback: if no code and no explicit error, redirect to login with a generic message
  console.warn("Auth callback accessed without code or error parameter.")
  return NextResponse.redirect(`${origin}/login?error=auth_callback_invalid_access`)
}
