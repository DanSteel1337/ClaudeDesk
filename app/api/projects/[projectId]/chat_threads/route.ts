import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

// GET /api/projects/[projectId]/chat_threads - List chat threads for a project
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

    // Verify user owns the project
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single()

    if (projectError || !projectData) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 })
    }

    const { data: chatThreads, error } = await supabase
      .from("chat_threads")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Error fetching chat threads:", error)
      return NextResponse.json({ error: "Failed to fetch chat threads" }, { status: 500 })
    }
    return NextResponse.json(chatThreads)
  } catch (error) {
    console.error("API Error fetching chat threads:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/projects/[projectId]/chat_threads - Create a new chat thread in a project
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
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

    // Verify user owns the project
    const { data: projectData, error: projectErrorCheck } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single()

    if (projectErrorCheck || !projectData) {
      return NextResponse.json(
        { error: "Project not found or access denied for creating chat thread" },
        { status: 404 },
      )
    }

    const { title, model } = (await request.json()) as { title?: string; model?: string }

    // Fetch user's preferred model if not provided
    let threadModel = model
    if (!threadModel) {
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("preferred_model")
        .eq("user_id", user.id)
        .single()
      threadModel = userSettings?.preferred_model || "claude-3-5-sonnet-20241022" // Default if no setting
    }

    const { data: newThread, error: dbError } = await supabase
      .from("chat_threads")
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: title || "New Chat", // Default title
        model: threadModel,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error creating chat thread:", dbError)
      return NextResponse.json({ error: "Failed to create chat thread" }, { status: 500 })
    }

    return NextResponse.json(newThread, { status: 201 })
  } catch (error) {
    console.error("API Error creating chat thread:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
