"use client" // Make it a client component to read searchParams

import { AuthForm } from "@/components/auth/auth-form"
import Link from "next/link"
import { useSearchParams } from "next/navigation" // Import useSearchParams
import { useEffect, useState } from "react"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const error = searchParams.get("error")
    const message = searchParams.get("message")

    if (error) {
      if (message) {
        setErrorMessage(decodeURIComponent(message))
      } else if (error === "auth_callback_exchange_failed") {
        setErrorMessage("Failed to complete authentication. Please try again.")
      } else if (error === "auth_callback_invalid_access") {
        setErrorMessage("Invalid access to authentication callback.")
      } else {
        setErrorMessage("An authentication error occurred. Please try again.")
      }
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold hover:text-gray-700">
            ClaudeDesk
          </Link>
          <p className="mt-2 text-gray-600">Unlimited Claude AI Documents</p>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        <AuthForm mode="login" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
