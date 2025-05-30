import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { Toaster } from "@/components/ui/toaster" // Assuming you have a Toaster for notifications

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <DashboardNav user={user} />
      <main className="flex-grow container mx-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <Toaster /> {/* Add Toaster for app-wide notifications */}
    </div>
  )
}
