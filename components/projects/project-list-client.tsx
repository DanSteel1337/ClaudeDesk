"use client"

import { useState, useEffect } from "react"
import type { Project } from "@/types/database"
import ProjectCard from "./project-card"
import CreateProjectDialog from "./create-project-dialog"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2 } from "lucide-react" // Added Loader2
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner" // For error toasts

type ProjectListClientProps = {
  initialProjects: Project[]
}

export default function ProjectListClient({ initialProjects }: ProjectListClientProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false) // For manual refresh

  useEffect(() => {
    setProjects(initialProjects)
    setIsLoading(false)
  }, [initialProjects])

  const fetchProjects = async () => {
    setIsFetching(true)
    toast.dismiss()
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch projects")
      }
      const fetchedProjects = (await response.json()) as Project[]
      setProjects(fetchedProjects)
      toast.success("Projects list refreshed.")
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsFetching(false)
    }
  }

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prevProjects) => [newProject, ...prevProjects])
    // No need to navigate here, user stays on projects list
  }

  const handleProjectDeleted = (deletedProjectId: string) => {
    setProjects((prevProjects) => prevProjects.filter((p) => p.id !== deletedProjectId))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchProjects} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" /> // Icon can be changed to RefreshCw
            )}
            Refresh
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[200px] rounded-lg" /> // Adjusted height
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400">No projects yet!</h2>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Get started by creating your first project.</p>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onProjectDeleted={handleProjectDeleted} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
