import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "ClaudeDesk - Unlimited Claude AI Document Chat",
    template: "%s | ClaudeDesk",
  },
  description:
    "Upload 100MB+ documents and chat with Claude AI. Break free from token limits with project-based knowledge bases.",
  keywords: ["Claude AI", "Document Chat", "RAG", "AI Assistant", "PDF Chat", "Document Analysis"],
  authors: [{ name: "ClaudeDesk Team" }],
  creator: "ClaudeDesk",
  publisher: "ClaudeDesk",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "ClaudeDesk - Unlimited Claude AI Document Chat",
    description: "Upload 100MB+ documents and chat with Claude AI. Break free from token limits.",
    siteName: "ClaudeDesk",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClaudeDesk - Unlimited Claude AI Document Chat",
    description: "Upload 100MB+ documents and chat with Claude AI. Break free from token limits.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
          </div>
          <Toaster position="top-right" expand={false} richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
