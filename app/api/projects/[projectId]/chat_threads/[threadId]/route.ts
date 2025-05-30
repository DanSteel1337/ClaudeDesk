import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

// DELETE /api/projects/[projectId]/chat_threads/[threadId] - Delete a chat thread
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; threadId: string } }) {
  const { projectId, threadId } = params
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!projectId || !threadId) {
      return NextResponse.json({ error: "Project ID and Thread ID are required" }, { status: 400 })
    }

    // Verify ownership through project and user_id on the thread itself
    const { error: deleteError } = await supabase
      .from("chat_threads")
      .delete()
      .eq("id", threadId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("Error deleting chat thread:", deleteError)
      // Check if it's a "not found" type error
      if (deleteError.code === "PGRST116" || deleteError.details?.includes("0 rows")) {
        return NextResponse.json({ error: "Chat thread not found or access denied" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to delete chat thread" }, { status: 500 })
    }

    return NextResponse.json({ message: "Chat thread deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("API Error deleting chat thread:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
