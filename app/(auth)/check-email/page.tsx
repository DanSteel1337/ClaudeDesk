import Link from "next/link"
import { MailCheck } from "lucide-react"

export const metadata = {
  title: "Check Your Email - ClaudeDesk",
}

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center items-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <Link href="/" className="inline-block mb-6">
            <h1 className="text-3xl font-bold text-primary">ClaudeDesk</h1>
          </Link>
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Confirm Your Email</h2>
          <p className="mt-3 text-md text-gray-600 dark:text-gray-400">
            We've sent a confirmation link to your email address. Please click the link to activate your account.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            If you don't see the email, please check your spam folder.
          </p>
        </div>
        <div className="mt-6">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
