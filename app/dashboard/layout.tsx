"use client"

import type React from "react"
import { LayoutGrid, Settings, LogOut } from "lucide-react" // Added LogOut
import { usePathname, useRouter } from "next/navigation" // Added useRouter
import Link from "next/link"
import { Button } from "@/components/ui/button" // For logout button
import { createClient } from "@/lib/supabase/client" // For client-side logout action
import { toast } from "sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    toast.loading("Logging out...")
    const { error } = await supabase.auth.signOut()
    toast.dismiss()
    if (error) {
      toast.error("Logout failed: " + error.message)
    } else {
      toast.success("Logged out successfully.")
      router.push("/login")
      router.refresh() // Ensure server state is cleared
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-64 border-r bg-white dark:bg-gray-800 p-4 flex flex-col justify-between">
        <div>
          <div className="mb-6">
            <Link href="/dashboard/projects" className="flex items-center gap-2 font-bold text-xl text-primary">
              {/* Replace with your logo or brand */}
              <span>ClaudeDesk</span>
            </Link>
          </div>
          <nav className="grid items-start gap-2">
            <Link
              href="/dashboard/projects"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted ${
                pathname.startsWith("/dashboard/projects") || pathname === "/dashboard"
                  ? "bg-muted text-primary font-medium"
                  : ""
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Projects
            </Link>
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted ${
                pathname === "/dashboard/settings" ? "bg-muted text-primary font-medium" : ""
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
        <div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 justify-start px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
