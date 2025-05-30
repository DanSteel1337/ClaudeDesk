import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large" }, { status: 400 })
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
    })

    // Save document record to database
    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        name: file.name,
        file_url: blob.url,
        file_size: file.size,
        mime_type: file.type,
        status: "processing",
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }

    // Trigger document processing asynchronously
    // In a production app, this would ideally be a call to a background job queue
    // or a separate microservice. For this example, we'll simulate an async call.
    // We won't await this, to respond to the client quickly.
    fetch(`${new URL(request.url).origin}/api/process/${document.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // You might need to pass auth headers if your process endpoint is protected
        // For example, if using a service role key for server-to-server calls:
        // 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
    }).catch((err) => {
      console.error(`Failed to trigger processing for document ${document.id}:`, err)
      // Optionally, update document status to 'pending_processing_trigger_failed'
    })

    // The document status is already 'processing' by default from the DB schema.
    // The /api/process/[documentId] route will update it to 'completed' or 'failed'.

    return NextResponse.json({
      success: true,
      document: document, // Return the document object from the insert operation
      message: "File uploaded successfully. Processing started.",
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
