import { AuthForm } from "@/components/auth/auth-form"
import Link from "next/link"

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold hover:text-gray-700">
            ClaudeDesk
          </Link>
          <p className="mt-2 text-gray-600">Reset your password</p>
        </div>
        <AuthForm mode="forgot_password" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Remembered your password?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
