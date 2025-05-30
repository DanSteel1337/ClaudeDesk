import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProjectListClient from "@/components/projects/project-list-client"
import type { Project } from "@/types/database"

export const runtime = "edge"

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (projectsError) {
    console.error("Error fetching projects:", projectsError)
    // Optionally, render an error message to the user
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">My Projects</h1>
        <p className="text-red-500">Error fetching projects. Please try again later.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <ProjectListClient initialProjects={(projects as Project[]) || []} />
    </div>
  )
}
