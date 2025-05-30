"use client"

import type { Project } from "@/types/database"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

interface ProjectDetailsClientProps {
  project: Project
}

export default function ProjectDetailsClient({ project: initialProject }: ProjectDetailsClientProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [name, setName] = useState(initialProject.name)
  const [description, setDescription] = useState(initialProject.description || "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveChanges = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT", // Assuming you'll add a PUT endpoint to update project details
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update project")
      }
      const updatedProject = await response.json()
      setProject(updatedProject)
      toast.success("Project details updated successfully!")
    } catch (error) {
      toast.error((error as Error).message || "Could not update project details.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Details</CardTitle>
        <CardDescription>View and manage your project's information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveChanges} className="space-y-4">
          <div>
            <Label htmlFor="projectId">Project ID</Label>
            <Input id="projectId" value={project.id} readOnly disabled className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">This is your unique project identifier.</p>
          </div>
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input id="projectName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="projectDescription">Description</Label>
            <Textarea
              id="projectDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={4}
              placeholder="A brief description of your project."
            />
          </div>
          <div>
            <Label htmlFor="createdAt">Created At</Label>
            <Input
              id="createdAt"
              value={new Date(project.created_at).toLocaleString()}
              readOnly
              disabled
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="updatedAt">Last Updated</Label>
            <Input
              id="updatedAt"
              value={new Date(project.updated_at).toLocaleString()}
              readOnly
              disabled
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
