import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OpenAI } from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ULTRA-CONSERVATIVE settings to guarantee success
const ULTRA_SAFE_CONFIG = {
  MAX_CHUNK_CHARS: 400,      // Very small chunks to avoid any token issues
  OVERLAP_CHARS: 50,         // Minimal overlap
  BATCH_SIZE: 1,             // Process one at a time to avoid rate limits
  BATCH_DELAY_MS: 2000,      // 2 second delay between chunks
  MAX_RETRIES: 5,            // More retries
  RETRY_DELAY_MS: 3000,      // Longer retry delays
} as const

// SIMPLE token estimation - very conservative
function estimateTokensSimple(text: string): number {
  // Ultra-conservative: assume 2.5 characters per token
  // This is very safe but will create more chunks
  return Math.ceil(text.length / 2.5)
}

// SIMPLE chunking - no fancy logic, just reliable splitting
function createSimpleChunks(text: string, documentTitle: string): Array<{
  content: string
  context: string
  tokens: number
}> {
  console.log(`Creating simple chunks for ${text.length} characters`)
  
  const chunks: Array<{content: string, context: string, tokens: number}> = []
  
  // Split text into sentences first
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  if (sentences.length === 0) {
    return chunks
  }
  
  let currentChunk = ""
  
  for (const sentence of sentences) {
    const testChunk = currentChunk + (currentChunk ? ". " : "") + sentence
    
    // If adding this sentence would make chunk too big, save current chunk
    if (testChunk.length > ULTRA_SAFE_CONFIG.MAX_CHUNK_CHARS && currentChunk.length > 0) {
      const tokens = estimateTokensSimple(currentChunk)
      
      // Only create chunk if it's not empty and not too big
      if (currentChunk.trim().length > 0 && tokens < 200) {
        chunks.push({
          content: currentChunk.trim(),
          context: `Document: ${documentTitle}`,
          tokens: tokens
        })
      }
      
      // Start new chunk
      currentChunk = sentence
    } else {
      currentChunk = testChunk
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    const tokens = estimateTokensSimple(currentChunk)
    if (tokens < 200) {
      chunks.push({
        content: currentChunk.trim(),
        context: `Document: ${documentTitle}`,
        tokens: tokens
      })
    }
  }
  
  console.log(`Created ${chunks.length} simple chunks`)
  return chunks
}

// SIMPLE text extraction
async function extractTextSimple(fileUrl: string, mimeType: string): Promise<string> {
  console.log(`Extracting text from ${mimeType}`)
  
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }

  switch (mimeType) {
    case "text/plain":
    case "text/csv":
      return await response.text()
      
    case "application/pdf": {
      const pdfParse = await import('pdf-parse/lib/pdf-parse.js')
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const data = await pdfParse.default(buffer)
      return data.text
    }
    
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import('mammoth')
      const arrayBuffer = await response.arrayBuffer()
      const { value: text } = await mammoth.extractRawText({ arrayBuffer })
      return text
    }
    
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

// SIMPLE processing with extensive logging
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let documentId = "unknown"
  
  try {
    console.log("🔄 Starting document processing...")
    
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY missing")
      return NextResponse.json(
        { error: "Server configuration error: OpenAI API key missing" }, 
        { status: 500 }
      )
    }

    // Parse request
    const body = await request.json()
    documentId = body.documentId
    const projectId = body.projectId

    console.log(`🔄 Processing document ${documentId} in project ${projectId}`)

    if (!documentId || !projectId) {
      return NextResponse.json(
        { error: "Document ID and Project ID are required" }, 
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // 1. Fetch document
    console.log(`📄 Fetching document ${documentId}...`)
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, file_url, mime_type, user_id, project_id, name, file_size")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .single()

    if (docError || !document) {
      console.error("❌ Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" }, 
        { status: 404 }
      )
    }

    console.log(`✅ Document found: ${document.name}`)

    // 2. Update status to processing
    console.log(`🔄 Updating status to processing...`)
    const { error: statusError } = await supabase
      .from("documents")
      .update({ 
        status: "processing", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)

    if (statusError) {
      console.error("❌ Failed to update status:", statusError)
    } else {
      console.log("✅ Status updated to processing")
    }

    // 3. Extract text
    if (!document.file_url || !document.mime_type) {
      throw new Error("Missing file URL or MIME type")
    }

    console.log(`📄 Extracting text from ${document.mime_type}...`)
    const textContent = await extractTextSimple(document.file_url, document.mime_type)
    console.log(`✅ Extracted ${textContent.length} characters`)

    if (!textContent.trim()) {
      throw new Error("No text content extracted")
    }

    // Size validation
    if (textContent.length > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(`Text too large: ${textContent.length} chars`)
    }

    // 4. Create chunks
    console.log(`🔧 Creating chunks...`)
    const chunks = createSimpleChunks(textContent, document.name || "Unknown Document")
    
    if (chunks.length === 0) {
      throw new Error("No chunks created")
    }

    console.log(`✅ Created ${chunks.length} chunks`)

    // Validate chunks
    const maxTokens = Math.max(...chunks.map(c => c.tokens))
    console.log(`📊 Max tokens per chunk: ${maxTokens}`)
    
    if (maxTokens > 150) {
      throw new Error(`Chunk too large: ${maxTokens} tokens`)
    }

    // 5. Process chunks ONE BY ONE with extensive logging
    console.log(`🔄 Processing ${chunks.length} chunks one by one...`)
    let processedCount = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length} (${chunk.tokens} tokens, ${chunk.content.length} chars)`)
      
      let success = false
      let lastError = null

      // Retry logic for each chunk
      for (let attempt = 1; attempt <= ULTRA_SAFE_CONFIG.MAX_RETRIES; attempt++) {
        try {
          console.log(`  📡 Attempt ${attempt}/${ULTRA_SAFE_CONFIG.MAX_RETRIES} - Generating embedding...`)
          
          // Generate embedding
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk.content,
          })
          
          console.log(`  ✅ Embedding generated successfully`)
          
          const embedding = embeddingResponse.data[0].embedding

          // Store chunk
          console.log(`  💾 Storing chunk in database...`)
          const { error: insertError } = await supabase
            .from("document_chunks")
            .insert({
              document_id: document.id,
              user_id: document.user_id,
              project_id: document.project_id,
              content: chunk.content,
              context: chunk.context,
              embedding: embedding,
              chunk_index: i,
              tokens: chunk.tokens,
            })

          if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`)
          }

          console.log(`  ✅ Chunk ${i + 1} stored successfully`)
          processedCount++
          success = true
          break // Success, exit retry loop

        } catch (error) {
          lastError = error
          console.error(`  ❌ Attempt ${attempt} failed:`, error.message)
          
          if (attempt < ULTRA_SAFE_CONFIG.MAX_RETRIES) {
            console.log(`  ⏳ Waiting ${ULTRA_SAFE_CONFIG.RETRY_DELAY_MS}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, ULTRA_SAFE_CONFIG.RETRY_DELAY_MS))
          }
        }
      }

      if (!success) {
        console.error(`❌ All attempts failed for chunk ${i + 1}`)
        throw new Error(`Chunk ${i + 1} processing failed: ${lastError?.message}`)
      }

      // Delay between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        console.log(`  ⏳ Waiting ${ULTRA_SAFE_CONFIG.BATCH_DELAY_MS}ms before next chunk...`)
        await new Promise(resolve => setTimeout(resolve, ULTRA_SAFE_CONFIG.BATCH_DELAY_MS))
      }
    }

    // 6. Mark as completed
    console.log(`🔄 Marking document as completed...`)
    const { error: completeError } = await supabase
      .from("documents")
      .update({ 
        status: "completed", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)

    if (completeError) {
      console.error("❌ Failed to mark as completed:", completeError)
    } else {
      console.log("✅ Document marked as completed")
    }

    const processingTime = Date.now() - startTime
    console.log(`🎉 Processing completed successfully!`)
    console.log(`📊 Stats: ${processedCount} chunks, ${textContent.length} chars, ${processingTime}ms`)

    return NextResponse.json({
      message: "Document processed successfully",
      documentId,
      chunksCreated: processedCount,
      textLength: textContent.length,
      processingTimeMs: processingTime
    }, { status: 200 })

  } catch (error) {
    console.error(`❌ Fatal error processing document ${documentId}:`, error)
    
    // Try to mark document as failed
    try {
      const supabase = createSupabaseAdminClient()
      await supabase
        .from("documents")
        .update({ 
          status: "failed", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", documentId)
      console.log("✅ Document marked as failed")
    } catch (statusError) {
      console.error("❌ Failed to update status to failed:", statusError)
    }
    
    return NextResponse.json(
      { error: `Document processing failed: ${error.message}` }, 
      { status: 500 }
    )
  }
}
