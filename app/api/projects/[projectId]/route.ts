import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

// GET /api/projects/[projectId] - Get a specific project
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const projectId = params.projectId
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single()

    if (error) {
      console.error("Error fetching project:", error)
      if (error.code === "PGRST116") {
        // PostgREST error for "Searched for one row, but found 0"
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error("API Error fetching project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/projects/[projectId] - Update a specific project
export async function PUT(request: NextRequest, { params }: { params: { projectId: string } }) {
  const projectId = params.projectId
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const { name, description } = await request.json()

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(), // Manually set updated_at as trigger might not fire for all clients
      })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating project:", updateError)
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Project not found or access denied for update" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
    }

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found or access denied for update" }, { status: 404 })
    }

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error("API Error updating project:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/projects/[projectId] - Delete a specific project
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string } }) {
  const projectId = params.projectId
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    // Check if the project belongs to the user before deleting
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 })
    }

    // RLS should handle cascading deletes if set up correctly.
    // If not, you might need to manually delete related documents, chunks, chat_threads, etc.
    // For now, relying on RLS and database cascade constraints.
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", user.id) // Double check ownership

    if (deleteError) {
      console.error("Error deleting project:", deleteError)
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
    }

    return NextResponse.json({ message: "Project deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("API Error deleting project:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
