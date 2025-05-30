import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

// GET /api/projects - List projects for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching projects:", error)
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
    }

    return NextResponse.json(projects)
  } catch (error) {
    console.error("API Error fetching projects:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description } = await request.json()

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    const { data: newProject, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating project:", error)
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
    }

    return NextResponse.json(newProject, { status: 201 })
  } catch (error) {
    console.error("API Error creating project:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
