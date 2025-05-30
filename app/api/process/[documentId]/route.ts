import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processDocument } from "@/lib/document-processor"
import type { Document } from "@/types/database"

export const runtime = "edge"

export async function POST(request: NextRequest, { params }: { params: { documentId: string } }) {
  const documentId = params.documentId

  if (!documentId) {
    return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Check authentication (ensure only authorized users/systems can trigger this)
    // For simplicity, we'll assume a service role key or an authenticated user with rights.
    // In a production app, you'd want robust auth here.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch the document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id) // Ensure user owns the document
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 })
    }

    if (document.status === "completed") {
      return NextResponse.json({ message: "Document already processed" }, { status: 200 })
    }

    // Update status to 'processing' immediately
    await supabase
      .from("documents")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", documentId)

    // Perform processing (this can be time-consuming)
    // For Vercel Edge Functions, there's a timeout (e.g., 15s for Hobby, up to 5 mins for Pro/Enterprise with streaming).
    // If processing is longer, consider Vercel Serverless Functions or background jobs.
    const result = await processDocument(supabase, document as Document)

    if (result.success) {
      return NextResponse.json({ message: result.message || "Document processed successfully" })
    } else {
      return NextResponse.json({ error: result.message || "Failed to process document" }, { status: 500 })
    }
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error)
    // Attempt to mark as failed if an unexpected error occurs
    try {
      const supabaseAdmin = await createClient() // Use admin client if needed for fallback status update
      await supabaseAdmin.from("documents").update({ status: "failed" }).eq("id", documentId)
    } catch (failError) {
      console.error("Failed to update document status to failed:", failError)
    }
    return NextResponse.json({ error: "Internal server error during processing" }, { status: 500 })
  }
}
