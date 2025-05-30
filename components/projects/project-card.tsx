"use client"

import Link from "next/link"
import type { Project } from "@/types/database"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Trash2, BrainCircuit } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useState } from "react"

interface ProjectCardProps {
  project: Project
  onProjectDeleted: (projectId: string) => void
}

export default function ProjectCard({ project, onProjectDeleted }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete project")
      }
      toast.success(`Project "${project.name}" deleted successfully.`)
      onProjectDeleted(project.id)
    } catch (error) {
      console.error("Error deleting project:", error)
      toast.error((error as Error).message || "Could not delete project.")
    } finally {
      setIsDeleting(false)
    }
  }

  const projectDescription = project.description || "No description provided."
  const formattedDate = new Date(project.created_at).toLocaleDateString()

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <BrainCircuit className="h-8 w-8 text-primary mb-2" />
          {/* Placeholder for Edit button if needed later */}
        </div>
        <CardTitle className="text-xl font-semibold">{project.name}</CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-400">Created: {formattedDate}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{projectDescription}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-4 border-t mt-auto">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-1" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the project "{project.name}" and all its
                associated data (documents, chat threads, etc.).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                {isDeleting ? "Deleting..." : "Yes, delete project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button asChild variant="default" size="sm">
          <Link href={`/dashboard/projects/${project.id}`}>
            Open Project <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
