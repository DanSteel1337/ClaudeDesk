import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ChatInterface from "@/components/chat/chat-interface" // Assuming this exists and can be adapted
import type { ChatThread, Project } from "@/types/database"

export const runtime = "edge"

interface ChatPageProps {
  params: {
    projectId: string
    threadId: string
  }
}

async function getChatData(projectId: string, threadId: string, userId: string) {
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single()

  if (projectError || !project) {
    console.error("Error fetching project for chat:", projectError)
    return { project: null, chatThread: null }
  }

  const { data: chatThread, error: threadError } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("id", threadId)
    .eq("project_id", projectId) // Ensure thread belongs to project
    .eq("user_id", userId) // Ensure thread belongs to user
    .single()

  if (threadError || !chatThread) {
    console.error("Error fetching chat thread:", threadError)
    return { project: project as Project, chatThread: null }
  }
  return { project: project as Project, chatThread: chatThread as ChatThread }
}

export default async function ProjectChatPage({ params }: ChatPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { project, chatThread } = await getChatData(params.projectId, params.threadId, user.id)

  if (!project) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500">Project Not Found</h1>
        <p>The project associated with this chat does not exist or you do not have permission.</p>
        <Link href="/dashboard/projects" className="mt-4 inline-block text-blue-500 hover:underline">
          Back to Projects
        </Link>
      </div>
    )
  }

  if (!chatThread) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500">Chat Thread Not Found</h1>
        <p>This chat thread does not exist or you do not have permission.</p>
        <Link
          href={`/dashboard/projects/${params.projectId}`}
          className="mt-4 inline-block text-blue-500 hover:underline"
        >
          Back to Project "{project.name}"
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Project: {project.name}
        </Link>
        <h1 className="text-xl font-semibold mt-1">{chatThread.title || "Chat"}</h1>
        <p className="text-xs text-muted-foreground">Model: {chatThread.model}</p>
      </header>
      <div className="flex-grow overflow-y-auto">
        <ChatInterface
          initialMessages={[]} // Messages will be fetched client-side by ChatInterface
          chatThreadId={chatThread.id}
          projectId={project.id} // Pass projectId for RAG context
          currentModel={chatThread.model}
        />
      </div>
    </div>
  )
}
import Link from "next/link" // For the Link component
