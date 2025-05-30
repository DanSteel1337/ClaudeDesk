import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { del } from "@vercel/blob"

export const runtime = "edge"

// DELETE /api/projects/[projectId]/documents/[documentId] - Delete a document
export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; documentId: string } }) {
  const { projectId, documentId } = params
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!projectId || !documentId) {
      return NextResponse.json({ error: "Project ID and Document ID are required" }, { status: 400 })
    }

    // Fetch the document to get its file_url and verify ownership
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_url, user_id, project_id")
      .eq("id", documentId)
      .eq("project_id", projectId) // Ensure it's part of the correct project
      .eq("user_id", user.id) // Ensure it belongs to the user
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 })
    }

    // Delete from Vercel Blob first
    if (document.file_url) {
      try {
        await del(document.file_url)
      } catch (blobError) {
        // Log error but proceed to delete from DB, as the file might already be gone or URL invalid
        console.error("Error deleting file from Blob storage:", blobError)
      }
    }

    // Delete from Supabase (RLS and CASCADE should handle chunks)
    const { error: deleteDbError } = await supabase.from("documents").delete().eq("id", documentId)

    if (deleteDbError) {
      console.error("Error deleting document from DB:", deleteDbError)
      return NextResponse.json({ error: "Failed to delete document from database" }, { status: 500 })
    }

    return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("API Error deleting document:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
