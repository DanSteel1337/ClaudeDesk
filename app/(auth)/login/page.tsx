import AuthForm from "@/components/auth/auth-form"
import Link from "next/link"

export const metadata = {
  title: "Login - ClaudeDesk",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <Link href="/" className="inline-block mb-6">
            {/* Replace with your logo component or text */}
            <h1 className="text-3xl font-bold text-center text-primary">ClaudeDesk</h1>
          </Link>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Log in to your account
          </h2>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <AuthForm mode="login" />
        </div>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">Powered by v0.dev</p>
      </div>
    </div>
  )
}
