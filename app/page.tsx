import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrainCircuit, UploadCloud, MessageSquare, Zap, Database, Lock } from "lucide-react"
import { PricingPlans } from "@/components/pricing/pricing-plans"
import { PricingFAQ } from "@/components/pricing/pricing-faq"
import { ComparisonTable } from "@/components/pricing/comparison-table"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-950/95 dark:supports-[backdrop-filter]:bg-gray-950/60">
        <div className="container flex h-16 items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center space-x-2" prefetch={false}>
            <BrainCircuit className="h-7 w-7 text-claude-blue-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-claude-blue-600 to-claude-blue-500 bg-clip-text text-transparent">
              ClaudeDesk
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-claude-blue-600 transition-colors"
              prefetch={false}
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-gray-600 hover:text-claude-blue-600 transition-colors"
              prefetch={false}
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="text-sm font-medium text-gray-600 hover:text-claude-blue-600 transition-colors"
              prefetch={false}
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-gray-600 hover:text-claude-blue-600 transition-colors"
              prefetch={false}
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-claude-blue-600 transition-colors"
              prefetch={false}
            >
              Login
            </Link>
            <Button asChild className="bg-claude-blue-500 hover:bg-claude-blue-600 text-white shadow-sm">
              <Link href="/signup" prefetch={false}>
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-br from-claude-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="container px-4 md:px-6 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                Unlock Your Project's Full Potential with <span className="text-claude-blue-500">ClaudeDesk</span>
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Go beyond token limits. Upload extensive documents, create project-specific knowledge bases, and chat
                intelligently with Claude using your own API key.
              </p>
              <div className="space-x-4">
                <Button asChild size="lg" className="bg-claude-blue-500 hover:bg-claude-blue-600">
                  <Link href="/signup" prefetch={false}>
                    Get Started
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-claude-blue-300 text-claude-blue-700 hover:bg-claude-blue-50"
                >
                  <Link href="/login" prefetch={false}>
                    Login
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-white dark:bg-gray-950">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="inline-block rounded-lg bg-claude-blue-100 text-claude-blue-800 px-3 py-1 text-sm">
                Key Features
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                Everything You Need for Smart AI Interaction
              </h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                ClaudeDesk empowers you to build deep, contextual understanding for your AI projects.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <BrainCircuit className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">Project-Based Knowledge</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Organize your work into distinct projects, each with its own dedicated knowledge base built from your
                  documents.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <UploadCloud className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">Large Document Uploads</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload 100MB+ of documents (PDF, DOCX, TXT, CSV) per project, breaking free from typical token
                  constraints.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">Contextual Chat</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Engage in intelligent conversations with Claude, leveraging the specific knowledge base of your active
                  project.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">No Daily Limits</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use your own Anthropic API key to avoid Claude.ai's daily usage limits and enjoy uninterrupted access.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">Persistent Knowledge</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your documents and chat history remain accessible indefinitely, unlike Claude.ai's temporary storage.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-7 w-7 text-claude-blue-500" />
                  <h3 className="text-lg font-bold">Secure & Private</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your data is encrypted and secured with enterprise-grade protection, ensuring your sensitive
                  information stays private.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-claude-blue-50 dark:bg-gray-900">
          <ComparisonTable />
        </section>

        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-white dark:bg-gray-950">
          <PricingPlans />
        </section>

        <section id="faq" className="w-full py-12 md:py-24 lg:py-32 bg-claude-blue-50 dark:bg-gray-900">
          <PricingFAQ />
        </section>

        <section className="w-full py-12 md:py-24 bg-white dark:bg-gray-950">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Ready to Get Started?</h2>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  Sign up today and experience the full power of Claude with your documents.
                </p>
              </div>
              <div className="space-x-4 mt-6">
                <Button asChild size="lg" className="bg-claude-blue-500 hover:bg-claude-blue-600">
                  <Link href="/signup" prefetch={false}>
                    Create Free Account
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-claude-blue-300 text-claude-blue-700 hover:bg-claude-blue-50"
                >
                  <Link href="#" prefetch={false}>
                    Schedule Demo
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} ClaudeDesk. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy Policy
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}
