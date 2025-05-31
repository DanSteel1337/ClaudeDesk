import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OpenAI } from "openai"

// Change to nodejs runtime for document processing libraries
export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MAX_CHUNK_SIZE = 500 // tokens
const CHUNK_OVERLAP = 100 // tokens

// Proper document text extraction with actual libraries
async function extractTextFromFile(fileUrl: string, mimeType: string): Promise<string> {
  console.log(`Extracting text from ${fileUrl} with type ${mimeType}`)
  
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    if (mimeType === "text/plain" || mimeType === "text/csv") {
      return await response.text()
    } 
    else if (mimeType === "application/pdf") {
      // Use dynamic import for Node.js-only library
      const pdfParse = await import('pdf-parse/lib/pdf-parse.js')
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const data = await pdfParse.default(buffer)
      return data.text
    } 
    else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // Use dynamic import for Node.js-only library
      const mammoth = await import('mammoth')
      const arrayBuffer = await response.arrayBuffer()
      const { value: text } = await mammoth.extractRawText({ arrayBuffer })
      return text
    }
    else {
      console.warn(`Unsupported MIME type for text extraction: ${mimeType}`)
      return ""
    }
  } catch (error) {
    console.error(`Text extraction failed for ${mimeType}:`, error)
    throw new Error(`Failed to extract text from ${mimeType}: ${error.message}`)
  }
}

// Proper token-based text chunking with context preservation
function splitTextIntoChunks(text: string, maxTokens: number, overlapTokens: number, documentTitle: string): Array<{content: string, context: string, tokens: number}> {
  const chunks: Array<{content: string, context: string, tokens: number}> = []
  
  // Split into sentences for better boundaries
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  let currentChunk: string[] = []
  let currentTokens = 0
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)
    
    // If adding this sentence would exceed max tokens and we have content
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      // Create chunk with current content
      const chunkContent = currentChunk.join(' ')
      const context = `Document: ${documentTitle}`
      
      chunks.push({
        content: chunkContent,
        context: context,
        tokens: currentTokens
      })
      
      // Start new chunk with overlap
      const overlapSentences = Math.floor(currentChunk.length * 0.2) // 20% overlap
      currentChunk = currentChunk.slice(-overlapSentences)
      currentTokens = currentChunk.reduce((sum, s) => sum + estimateTokens(s), 0)
    }
    
    currentChunk.push(sentence)
    currentTokens += sentenceTokens
  }
  
  // Add final chunk if it has content
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join(' ')
    const context = `Document: ${documentTitle}`
    
    chunks.push({
      content: chunkContent,
      context: context,
      tokens: currentTokens
    })
  }
  
  return chunks
}

// Better token estimation (approximation until we have actual tokenizer)
function estimateTokens(text: string): number {
  // More accurate estimation: ~4 characters per token on average
  // This is an approximation - for production, use actual tokenizer
  const words = text.split(/\s+/).length
  const chars = text.length
  
  // Heuristic: average of word-based and character-based estimates
  const wordEstimate = words * 1.3 // Words are typically 1.3 tokens
  const charEstimate = chars / 4   // ~4 chars per token
  
  return Math.ceil((wordEstimate + charEstimate) / 2)
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("CRITICAL: OPENAI_API_KEY is not configured")
      return NextResponse.json(
        { error: "Server configuration error: OpenAI API key missing" }, 
        { status: 500 }
      )
    }

    const body = await request.json()
    const { documentId, projectId } = body

    if (!documentId || !projectId) {
      return NextResponse.json(
        { error: "Document ID and Project ID are required" }, 
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // 1. Fetch document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, file_url, mime_type, user_id, project_id, name")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .single()

    if (docError || !document) {
      console.error("Error fetching document:", docError)
      return NextResponse.json(
        { error: "Document not found" }, 
        { status: 404 }
      )
    }

    // 2. Update status to processing
    await supabase
      .from("documents")
      .update({ 
        status: "processing", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)

    // 3. Extract text from file
    let textContent = ""
    if (document.file_url && document.mime_type) {
      try {
        textContent = await extractTextFromFile(document.file_url, document.mime_type)
        console.log(`Extracted ${textContent.length} characters from document`)
      } catch (extractionError) {
        console.error("Text extraction failed:", extractionError)
        await supabase
          .from("documents")
          .update({ 
            status: "failed", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", documentId)
        
        return NextResponse.json(
          { error: `Text extraction failed: ${extractionError.message}` },
          { status: 500 }
        )
      }
    } else {
      await supabase
        .from("documents")
        .update({ 
          status: "failed", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", documentId)
      
      return NextResponse.json(
        { error: "Document URL or MIME type missing" }, 
        { status: 400 }
      )
    }

    // 4. Check if we have content to process
    if (!textContent.trim()) {
      console.warn(`No text content extracted for document ${documentId}`)
      await supabase
        .from("documents")
        .update({ 
          status: "completed", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", documentId)
      
      return NextResponse.json(
        { 
          message: "Document processed successfully but no text content found", 
          documentId,
          chunksCreated: 0
        }, 
        { status: 200 }
      )
    }

    // 5. Split text into chunks with proper tokenization
    const chunks = splitTextIntoChunks(
      textContent, 
      MAX_CHUNK_SIZE, 
      CHUNK_OVERLAP, 
      document.name || "Unknown Document"
    )
    
    console.log(`Created ${chunks.length} chunks from document`)

    if (chunks.length === 0) {
      await supabase
        .from("documents")
        .update({ 
          status: "completed", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", documentId)
      
      return NextResponse.json(
        { 
          message: "Document processed but no chunks created", 
          documentId,
          chunksCreated: 0
        }, 
        { status: 200 }
      )
    }

    // 6. Process chunks in batches to avoid overwhelming OpenAI API
    const batchSize = 5
    let processedChunks = 0
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex
        
        try {
          // Generate embedding for chunk
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk.content,
          })
          
          const embedding = embeddingResponse.data[0].embedding

          // Store chunk with embedding
          const { error: insertError } = await supabase
            .from("document_chunks")
            .insert({
              document_id: document.id,
              user_id: document.user_id,
              project_id: document.project_id,
              content: chunk.content,
              context: chunk.context,
              embedding: embedding,
              chunk_index: chunkIndex,
              tokens: chunk.tokens,
            })

          if (insertError) {
            console.error(`Failed to insert chunk ${chunkIndex}:`, insertError)
            throw insertError
          }
          
          processedChunks++
          console.log(`Processed chunk ${chunkIndex + 1}/${chunks.length}`)
          
        } catch (chunkError) {
          console.error(`Failed to process chunk ${chunkIndex}:`, chunkError)
          throw new Error(`Chunk processing failed: ${chunkError.message}`)
        }
      })
      
      // Wait for batch to complete
      try {
        await Promise.all(batchPromises)
      } catch (batchError) {
        console.error(`Batch processing failed:`, batchError)
        
        // Mark document as failed
        await supabase
          .from("documents")
          .update({ 
            status: "failed", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", documentId)
        
        return NextResponse.json(
          { error: `Batch processing failed: ${batchError.message}` },
          { status: 500 }
        )
      }
      
      // Small delay between batches to be respectful to OpenAI API
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // 7. Mark document as completed
    await supabase
      .from("documents")
      .update({ 
        status: "completed", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)

    console.log(`Successfully processed document ${documentId} with ${processedChunks} chunks`)

    return NextResponse.json(
      { 
        message: "Document processed successfully", 
        documentId, 
        chunksCreated: processedChunks,
        textLength: textContent.length
      }, 
      { status: 200 }
    )

  } catch (error) {
    console.error("Process document error:", error)
    
    // Try to update document status if we have the ID
    try {
      const body = await request.json().catch(() => ({}))
      if (body.documentId) {
        const supabase = createSupabaseAdminClient()
        await supabase
          .from("documents")
          .update({ 
            status: "failed", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", body.documentId)
          .catch(console.error)
      }
    } catch {
      // Ignore errors in error handling
    }
    
    return NextResponse.json(
      { error: `Document processing failed: ${error.message}` }, 
      { status: 500 }
    )
  }
}
