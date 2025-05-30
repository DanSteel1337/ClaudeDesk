import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { put, del } from "@vercel/blob" // For Vercel Blob storage
import { customAlphabet } from "nanoid"

export const runtime = "edge"

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 7)

// GET /api/projects/[projectId]/documents - List documents for a project
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

    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id) // Redundant due to project check, but good for safety
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching documents:", error)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
    return NextResponse.json(documents)
  } catch (error) {
    console.error("API Error fetching documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/projects/[projectId]/documents - Upload a new document to a project
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
      return NextResponse.json({ error: "Project not found or access denied for upload" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase()
    const allowedExtensions = ["pdf", "docx", "txt", "csv"]
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PDF, DOCX, TXT, CSV" }, { status: 400 })
    }

    // Max file size (e.g., 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    const uniqueFileName = `${nanoid()}-${file.name}`

    // Upload to Vercel Blob
    const blob = await put(uniqueFileName, file, {
      access: "public", // Or 'private' if you handle signed URLs
      contentType: file.type,
      addRandomSuffix: false, // We created a unique name already
    })

    // Save document metadata to Supabase
    const { data: newDocument, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        project_id: projectId,
        name: file.name, // Original file name
        file_url: blob.url,
        file_size: file.size,
        mime_type: file.type,
        status: "pending", // Initial status, to be processed
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error saving document to DB:", dbError)
      // Attempt to delete from blob if DB insert fails
      await del(blob.url).catch(console.error)
      return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 })
    }

    return NextResponse.json(newDocument, { status: 201 })
  } catch (error) {
    console.error("API Error uploading document:", error)
    return NextResponse.json({ error: "Internal server error during upload" }, { status: 500 })
  }
}
