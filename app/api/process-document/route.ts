// This is a new or significantly refactored API route for document processing
import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin" // Assuming an admin client for elevated privileges if needed for complex processing, or use server client
import { OpenAI } from "openai"
// For text extraction - you might need libraries like pdf-parse, mammoth, etc.
// These often require Node.js runtime. For Edge, consider simpler text extraction or an external service.
// For this example, I'll simulate text extraction.
// import pdf from 'pdf-parse'; // Example, might not be Edge compatible
// import mammoth from 'mammoth'; // Example for docx

export const runtime = "edge" // Or 'nodejs' if using Node.js specific libraries

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set. Document processing cannot proceed with embeddings.")
  // Update document status to 'failed' directly if OPENAI_API_KEY is essential and missing
  // For now, we let it proceed and fail at OpenAI client initialization or first API call,
  // which should be caught by the main try-catch.
  // Alternatively, return an error response immediately:
  // return NextResponse.json({ error: "Server configuration error: OpenAI API Key is missing." }, { status: 500 });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MAX_CHUNK_SIZE = 500 // tokens
const CHUNK_OVERLAP = 100 // tokens

async function extractTextFromFile(fileUrl: string, mimeType: string): Promise<string> {
  // In a real Edge environment, fetching and parsing complex files is tricky.
  // You might use a Vercel Function (Node.js) for this, or a third-party service.
  // For demonstration, let's assume a simple text fetch for .txt, and placeholders for others.
  console.log(`Fetching text from ${fileUrl} with type ${mimeType}`)
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch file for text extraction: ${response.statusText}`)
  }

  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return await response.text()
  } else if (mimeType === "application/pdf") {
    // PDF parsing is complex. pdf-parse is Node.js.
    // const arrayBuffer = await response.arrayBuffer();
    // const data = await pdf(Buffer.from(arrayBuffer)); // This line requires Node.js
    // return data.text;
    return "Simulated PDF text content. Implement actual PDF parsing for production."
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // DOCX parsing (e.g., mammoth.js) is also typically Node.js.
    // const arrayBuffer = await response.arrayBuffer();
    // const { value } = await mammoth.extractRawText({ arrayBuffer });
    // return value;
    return "Simulated DOCX text content. Implement actual DOCX parsing for production."
  }
  // Add more types as needed
  console.warn(`Unsupported mime type for text extraction: ${mimeType}`)
  return "" // Fallback for unsupported types
}

// Simple text splitter (conceptual)
function splitTextIntoChunks(text: string, maxTokens: number, overlapTokens: number): string[] {
  // This is a very naive splitter. Real token-based splitting is more complex.
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let currentChunkWords: string[] = []
  let currentTokenEstimate = 0

  for (const word of words) {
    const wordTokenEstimate = Math.ceil(word.length / 4) // Rough estimate
    if (currentTokenEstimate + wordTokenEstimate > maxTokens && currentChunkWords.length > 0) {
      chunks.push(currentChunkWords.join(" "))
      const overlapStart = Math.max(0, currentChunkWords.length - Math.floor(overlapTokens / (wordTokenEstimate || 1))) // very rough overlap
      currentChunkWords = currentChunkWords.slice(overlapStart)
      currentTokenEstimate = currentChunkWords.reduce((sum, w) => sum + Math.ceil(w.length / 4), 0)
    }
    currentChunkWords.push(word)
    currentTokenEstimate += wordTokenEstimate
  }
  if (currentChunkWords.length > 0) {
    chunks.push(currentChunkWords.join(" "))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("CRITICAL: OPENAI_API_KEY is not configured. Embeddings cannot be generated.")
      // Optionally, update the document status to 'failed' here if you know the document ID
      // For now, this log will appear, and the OpenAI call will fail later.
    }
    const { documentId, projectId } = await request.json()

    if (!documentId || !projectId) {
      return NextResponse.json({ error: "Document ID and Project ID are required" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient() // Use server client if admin not strictly needed

    // 1. Fetch document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, file_url, mime_type, user_id, project_id") // Ensure project_id is selected
      .eq("id", documentId)
      .eq("project_id", projectId) // Ensure it's the correct project
      .single()

    if (docError || !document) {
      console.error("Error fetching document for processing or not found:", docError)
      return NextResponse.json({ error: "Document not found or error fetching it" }, { status: 404 })
    }

    // Update status to 'processing'
    await supabase
      .from("documents")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", documentId)

    // 2. Extract text (simplified for Edge)
    let textContent = ""
    if (document.file_url && document.mime_type) {
      try {
        textContent = await extractTextFromFile(document.file_url, document.mime_type)
      } catch (extractionError) {
        console.error("Text extraction failed:", extractionError)
        await supabase
          .from("documents")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", documentId)
        return NextResponse.json(
          { error: `Text extraction failed: ${(extractionError as Error).message}` },
          { status: 500 },
        )
      }
    } else {
      await supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", documentId)
      return NextResponse.json({ error: "Document URL or MIME type missing" }, { status: 400 })
    }

    if (!textContent.trim()) {
      console.warn(`No text content extracted for document ${documentId}`)
      await supabase
        .from("documents")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", documentId) // Or 'failed' if no content is an error
      return NextResponse.json({ message: "No text content to process", documentId }, { status: 200 })
    }

    // 3. Split text into chunks
    const chunks = splitTextIntoChunks(textContent, MAX_CHUNK_SIZE, CHUNK_OVERLAP)
    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", documentId)
      return NextResponse.json(
        { message: "Document processed, no chunks created (empty or too small content).", documentId },
        { status: 200 },
      )
    }

    // 4. Generate embeddings for each chunk and store
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i]
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small", // Or your preferred model
          input: chunkContent,
        })
        const embedding = embeddingResponse.data[0].embedding

        await supabase.from("document_chunks").insert({
          document_id: document.id,
          user_id: document.user_id, // Store user_id on chunks
          project_id: document.project_id, // Store project_id on chunks
          content: chunkContent,
          embedding: embedding,
          chunk_index: i,
          tokens: Math.ceil(chunkContent.length / 4), // Rough token count
        })
      } catch (embeddingError) {
        console.error(`Failed to create embedding for chunk ${i} of document ${document.id}:`, embeddingError)
        // Decide on error handling: fail all, skip chunk, etc.
        // For now, log and continue, but mark document as potentially incomplete or failed.
        await supabase
          .from("documents")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", documentId)
        return NextResponse.json(
          { error: `Embedding generation failed for a chunk: ${(embeddingError as Error).message}` },
          { status: 500 },
        )
      }
    }

    // 5. Update document status to 'completed'
    await supabase
      .from("documents")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", documentId)

    return NextResponse.json(
      { message: "Document processed successfully", documentId, chunksCreated: chunks.length },
      { status: 200 },
    )
  } catch (error) {
    console.error("Full error in process-document:", error)
    // Attempt to update document status to 'failed' if an ID is available
    const body = await request.json().catch(() => ({}))
    if (body.documentId) {
      const supabase = createSupabaseAdminClient()
      await supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", body.documentId)
        .catch(console.error)
    }
    return NextResponse.json({ error: `Internal server error: ${(error as Error).message}` }, { status: 500 })
  }
}
