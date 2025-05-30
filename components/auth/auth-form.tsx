"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link" // Import Link

interface AuthFormProps {
  mode: "login" | "signup" | "forgot_password" | "update_password"
  // update_password mode will require an access_token, typically from URL
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("") // Separate error state

  const supabase = createClient()

  const handleAuthError = (err: any) => {
    console.error("Auth error:", err)
    if (err.message) {
      if (err.message.toLowerCase().includes("invalid login credentials")) {
        setError("Invalid email or password. Please try again.")
      } else if (err.message.toLowerCase().includes("user already registered")) {
        setError("This email is already registered. Please try logging in.")
      } else if (err.message.toLowerCase().includes("rate limit exceeded")) {
        setError("Too many attempts. Please try again later.")
      } else {
        setError(err.message)
      }
    } else {
      setError("An unexpected error occurred. Please try again.")
    }
    setMessage("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        })
        if (signUpError) throw signUpError
        setMessage("Check your email for the confirmation link!")
      } else if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        // Redirect will happen automatically via auth state change in middleware/layout
        // or you can explicitly redirect here if needed: window.location.href = '/chat';
        setMessage("Login successful! Redirecting...")
      } else if (mode === "forgot_password") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`, // Page to handle password update
        })
        if (resetError) throw resetError
        setMessage("Password reset email sent! Check your inbox.")
      } else if (mode === "update_password") {
        // This mode assumes the user is on /update-password page which gets the token
        // from the URL. Supabase handles this automatically if the session is active
        // from the reset link.
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        setMessage("Password updated successfully! You can now log in with your new password.")
        // Optionally redirect to login: setTimeout(() => window.location.href = '/login', 2000)
      }
    } catch (err) {
      handleAuthError(err)
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    if (mode === "login") return "Sign In"
    if (mode === "signup") return "Sign Up"
    if (mode === "forgot_password") return "Reset Password"
    if (mode === "update_password") return "Update Password"
    return ""
  }

  const getDescription = () => {
    if (mode === "login") return "Enter your credentials to access ClaudeDesk"
    if (mode === "signup") return "Create an account to get started with ClaudeDesk"
    if (mode === "forgot_password") return "Enter your email to receive a password reset link"
    if (mode === "update_password") return "Enter your new password"
    return ""
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== "update_password" && ( // Email not needed if session from reset link is active
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
          )}
          {(mode === "login" || mode === "signup" || mode === "update_password") && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={mode !== "forgot_password"}
                disabled={loading}
                minLength={6}
                placeholder={mode === "update_password" ? "New Password" : "••••••••"}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processing..." : getTitle()}
          </Button>

          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {mode === "login" && (
            <div className="text-sm text-center">
              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </Link>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
