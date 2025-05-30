"use client"

import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Loader2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const supabase = createClient()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    toast.dismiss()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`, // Your reset password page
    })

    if (error) {
      toast.error(error.message || "Failed to send password reset email.")
    } else {
      toast.success("Password reset email sent! Please check your inbox.")
      setMessage("If an account exists for this email, a password reset link has been sent.")
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
            Forgot Your Password?
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            No worries! Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full"
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </div>
            {message && <p className="text-sm text-green-600 dark:text-green-400 text-center">{message}</p>}
          </form>
        </div>
        <div className="text-center text-sm">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
