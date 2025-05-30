"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Loader2 } from "lucide-react"

interface AuthFormProps {
  mode: "login" | "signup"
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    toast.dismiss() // Dismiss any existing toasts

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        toast.error(error.message || "Signup failed. Please try again.")
      } else {
        toast.success("Signup successful! Please check your email to confirm your account.")
        router.push("/check-email") // Redirect to check email page
      }
    } else {
      // Login mode
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        toast.error(error.message || "Login failed. Please check your credentials.")
      } else {
        toast.success("Login successful! Redirecting...")
        router.push("/dashboard/projects") // Redirect to projects page
        router.refresh() // Important to refresh server components and layout
      }
    }
    setIsSubmitting(false)
  }

  return (
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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full"
          placeholder="••••••••"
          minLength={mode === "signup" ? 6 : undefined} // Supabase default min password length
          disabled={isSubmitting}
        />
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground mt-1">Password should be at least 6 characters.</p>
        )}
      </div>
      <div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : mode === "login" ? (
            "Log In"
          ) : (
            "Sign Up"
          )}
        </Button>
      </div>
      <div className="text-center text-sm">
        {mode === "login" ? (
          <>
            {"Don't have an account? "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        )}
      </div>
      {mode === "login" && (
        <div className="text-center text-sm mt-2">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>
      )}
    </form>
  )
}
