"use client" // Needs to be client component to handle potential session from reset link

import { AuthForm } from "@/components/auth/auth-form"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation" // For redirecting and checking params

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isValidSession, setIsValidSession] = useState(false)
  const [loadingCheck, setLoadingCheck] = useState(true)

  useEffect(() => {
    // Supabase client automatically handles the session when user lands from a reset link.
    // We check if there's an active session which implies the link was valid.
    // The `onAuthStateChange` with `PASSWORD_RECOVERY` event is key here.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true)
      }
      // If there's any session, it means the user is likely in the recovery flow
      if (session) {
        setIsValidSession(true)
      }
      setLoadingCheck(false)
    })

    // Initial check in case onAuthStateChange doesn't fire immediately or for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if it's a recovery session (might not be directly identifiable here without specific event)
        // For simplicity, any session on this page is assumed to be part of recovery flow or already logged in.
        setIsValidSession(true)
      }
      setLoadingCheck(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  if (loadingCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifying...</p>
      </div>
    )
  }

  if (!isValidSession && !searchParams.has("error")) {
    // If no valid session and no explicit error, the link might be invalid or expired.
    // Supabase might redirect internally or show an error if the token is invalid.
    // This is a fallback.
    // A more robust check might involve parsing the URL hash for Supabase tokens if needed.
    // However, `onAuthStateChange` with `PASSWORD_RECOVERY` is the preferred way.
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-red-600">Invalid or Expired Link</h1>
          <p className="mt-2 text-gray-700">
            The password reset link may be invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold hover:text-gray-700">
            ClaudeDesk
          </Link>
          <p className="mt-2 text-gray-600">Set your new password</p>
        </div>
        <AuthForm mode="update_password" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Password updated?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
