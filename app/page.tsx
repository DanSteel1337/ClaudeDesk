import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrainCircuit, UploadCloud, MessageSquare } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link href="#" className="flex items-center justify-center" prefetch={false}>
          <BrainCircuit className="h-6 w-6 text-primary" />
          <span className="ml-2 text-xl font-semibold">ClaudeDesk</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
            Login
          </Link>
          <Button asChild>
            <Link href="/signup" prefetch={false}>
              Sign Up
            </Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div className="container px-4 md:px-6 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                Unlock Your Project's Full Potential with <span className="text-primary">ClaudeDesk</span>
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Go beyond token limits. Upload extensive documents, create project-specific knowledge bases, and chat
                intelligently with Claude using your own API key.
              </p>
              <div className="space-x-4">
                <Button asChild size="lg">
                  <Link href="/signup" prefetch={false}>
                    Get Started
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/login" prefetch={false}>
                    Login
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Key Features</div>
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
                  <BrainCircuit className="h-7 w-7 text-primary" />
                  <h3 className="text-lg font-bold">Project-Based Knowledge</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Organize your work into distinct projects, each with its own dedicated knowledge base built from your
                  documents.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <UploadCloud className="h-7 w-7 text-primary" />
                  <h3 className="text-lg font-bold">Large Document Uploads</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload 100MB+ of documents (PDF, DOCX, TXT, CSV) per project, breaking free from typical token
                  constraints.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-7 w-7 text-primary" />
                  <h3 className="text-lg font-bold">Contextual Chat</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Engage in intelligent conversations with Claude, leveraging the specific knowledge base of your active
                  project.
                </p>
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
          {/* <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy
          </Link> */}
        </nav>
      </footer>
    </div>
  )
}
