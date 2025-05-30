import type React from "react"
import { LayoutDashboard, Settings, LogOut, LayoutGrid, MessageSquare, FileText } from "lucide-react"
import Link from "next/link"

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

interface SidebarNavProps {
  className?: string
}

export function SidebarNav({ className }: SidebarNavProps) {
  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      label: "Dashboard",
    },
    {
      href: "/dashboard/projects",
      icon: <LayoutGrid className="h-4 w-4" />,
      label: "Projects",
    },
    {
      href: "/dashboard/messages",
      icon: <MessageSquare className="h-4 w-4" />,
      label: "Messages",
    },
    {
      href: "/dashboard/documents",
      icon: <FileText className="h-4 w-4" />,
      label: "Documents",
    },
    {
      href: "/dashboard/settings",
      icon: <Settings className="h-4 w-4" />,
      label: "Settings",
    },
    {
      href: "/logout",
      icon: <LogOut className="h-4 w-4" />,
      label: "Logout",
    },
  ]

  return (
    <div className={className}>
      <div className="mb-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          {/* Replace with your logo or brand */}
          <span>Your Brand</span>
        </Link>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
