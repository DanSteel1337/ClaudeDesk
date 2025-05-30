// Simple server-side logout
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Error signing out:", error)
    // Optionally redirect to an error page or home with an error message
    const errorRedirectUrl = new URL("/", requestUrl.origin)
    errorRedirectUrl.searchParams.set("logout_error", "true")
    return NextResponse.redirect(errorRedirectUrl)
  }

  // Redirect to login page after successful logout
  return NextResponse.redirect(new URL("/login", requestUrl.origin), {
    // Ensure cookies are cleared by Supabase client, but this helps ensure redirection
    status: 302,
  })
}
