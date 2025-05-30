"use client"

import { useState, type FormEvent, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Loader2 } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Check for error from callback (e.g., expired token)
  useEffect(() => {
    const errorCode = searchParams.get("error_code")
    const errorDescription = searchParams.get("error_description")
    if (errorCode) {
      toast.error(errorDescription || "Failed to reset password. The link may be invalid or expired.")
      setError(errorDescription || "Password reset link is invalid or has expired.")
    }
  }, [searchParams])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.")
      return
    }
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    toast.dismiss()

    // The access_token (code) should be in the URL fragment (#) after Supabase redirects.
    // Supabase client handles this automatically when `updateUser` is called after `onAuthStateChange`
    // or `getSession` detects the recovery token in the URL.
    // We just need to call `updateUser`.

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      toast.error(updateError.message || "Failed to reset password.")
      setError(updateError.message)
    } else {
      toast.success("Password updated successfully! You can now log in.")
      setMessage("Your password has been successfully updated.")
      // Redirect to login after a short delay
      setTimeout(() => router.push("/login"), 2000)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex min-h-screen flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <Link href="/" className="inline-block mb-6">
            <h1 className="text-3xl font-bold text-center text-primary">ClaudeDesk</h1>
          </Link>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Reset Your Password
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          {error && !message && <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">{error}</p>}
          {message && <p className="text-sm text-green-600 dark:text-green-400 text-center mb-4">{message}</p>}
          {!error &&
            !message && ( // Only show form if no error/message from initial load or successful submission
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full"
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full"
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </div>
              </form>
            )}
        </div>
        <div className="text-center text-sm">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
