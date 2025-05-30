import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Project, Document, ChatThread } from "@/types/database"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, MessageSquare, Info } from "lucide-react"
import ProjectDocumentsClient from "@/components/projects/project-documents-client"
import ProjectChatThreadsClient from "@/components/projects/project-chat-threads-client"
import ProjectDetailsClient from "@/components/projects/project-details-client"

export const runtime = "edge"

interface ProjectPageProps {
  params: {
    projectId: string
  }
}

async function getProjectData(projectId: string, userId: string) {
  const supabase = await createClient()
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single()

  if (projectError || !project) {
    console.error("Error fetching project details:", projectError)
    return { project: null, documents: [], chatThreads: [] }
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (documentsError) {
    console.error("Error fetching documents:", documentsError)
  }

  const { data: chatThreads, error: chatThreadsError } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })

  if (chatThreadsError) {
    console.error("Error fetching chat threads:", chatThreadsError)
  }

  return {
    project: project as Project,
    documents: (documents as Document[]) || [],
    chatThreads: (chatThreads as ChatThread[]) || [],
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { project, documents, chatThreads } = await getProjectData(params.projectId, user.id)

  if (!project) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500">Project Not Found</h1>
        <p>The project you are looking for does not exist or you do not have permission to access it.</p>
        <Link href="/dashboard/projects" className="mt-4 inline-block text-blue-500 hover:underline">
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground">{project.description || "No description."}</p>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-3 mb-4">
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" /> Documents
          </TabsTrigger>
          <TabsTrigger value="chat_threads">
            <MessageSquare className="mr-2 h-4 w-4" /> Chat Threads
          </TabsTrigger>
          <TabsTrigger value="details">
            <Info className="mr-2 h-4 w-4" /> Details
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents">
          <ProjectDocumentsClient initialDocuments={documents} projectId={project.id} />
        </TabsContent>
        <TabsContent value="chat_threads">
          <ProjectChatThreadsClient initialChatThreads={chatThreads} projectId={project.id} />
        </TabsContent>
        <TabsContent value="details">
          <ProjectDetailsClient project={project} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper component for Link, not strictly necessary but good practice
import Link from "next/link"
