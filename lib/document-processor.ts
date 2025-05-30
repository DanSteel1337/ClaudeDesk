import type { SupabaseClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import pdf from "pdf-parse/lib/pdf-parse.js" // Using specific import for Edge compatibility
import { getEncoding } from "tiktoken"
import type { Document } from "@/types/database"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const tokenizer = getEncoding("cl100k_base")

const MAX_CHUNK_TOKENS = 500 // Optimal for Claude context and embedding models
const TOKEN_OVERLAP = 50

async function extractTextFromFile(fileBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      const data = await pdf(Buffer.from(fileBuffer))
      return data.text
    case "text/plain":
      return new TextDecoder().decode(fileBuffer)
    case "text/csv":
      // Basic CSV handling, might need more robust parsing for complex CSVs
      return new TextDecoder().decode(fileBuffer)
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      // TODO: Implement DOCX parsing (e.g., using Mammoth.js if Edge compatible, or a serverless function)
      console.warn("DOCX parsing not yet implemented. Returning empty string.")
      return ""
    default:
      console.warn(`Unsupported mime type: ${mimeType}. Returning empty string.`)
      return ""
  }
}

function chunkText(text: string, documentName: string): Array<{ content: string; context: string; tokens: number }> {
  const chunks: Array<{ content: string; context: string; tokens: number }> = []
  const sentences = text.split(/(?<=[.?!])\s+/) // Split by sentences

  let currentChunkTokens = 0
  let currentChunkSentences: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const sentenceTokens = tokenizer.encode(sentence).length

    if (currentChunkTokens + sentenceTokens > MAX_CHUNK_TOKENS) {
      if (currentChunkSentences.length > 0) {
        const chunkContent = currentChunkSentences.join(" ")
        chunks.push({
          content: chunkContent,
          context: `From document: ${documentName}`, // Basic context
          tokens: currentChunkTokens,
        })
      }
      // Start new chunk with overlap
      currentChunkSentences = currentChunkSentences.slice(-TOKEN_OVERLAP / 10) // Heuristic for sentence overlap
      currentChunkTokens = tokenizer.encode(currentChunkSentences.join(" ")).length
    }

    currentChunkSentences.push(sentence)
    currentChunkTokens += sentenceTokens

    // Handle last chunk
    if (i === sentences.length - 1 && currentChunkSentences.length > 0) {
      const chunkContent = currentChunkSentences.join(" ")
      chunks.push({
        content: chunkContent,
        context: `From document: ${documentName}`,
        tokens: currentChunkTokens,
      })
    }
  }
  return chunks
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // 1536 dimensions
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    return null
  }
}

export async function processDocument(
  supabase: SupabaseClient,
  document: Document,
): Promise<{ success: boolean; message?: string }> {
  if (!document.file_url) {
    return { success: false, message: "Document has no file URL." }
  }

  try {
    // 1. Download file from Vercel Blob
    const response = await fetch(document.file_url)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }
    const fileBuffer = await response.arrayBuffer()

    // 2. Extract text
    const textContent = await extractTextFromFile(fileBuffer, document.mime_type || "")
    if (!textContent.trim()) {
      await supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", document.id)
      return { success: false, message: "No text content extracted or unsupported file type." }
    }

    // 3. Chunk text
    const chunks = chunkText(textContent, document.name)

    // 4. Generate embeddings and save chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await generateEmbedding(chunk.content)

      if (embedding) {
        const { error: chunkError } = await supabase.from("document_chunks").insert({
          document_id: document.id,
          user_id: document.user_id,
          content: chunk.content,
          context: chunk.context,
          embedding: embedding,
          chunk_index: i,
          tokens: chunk.tokens,
        })
        if (chunkError) {
          console.error(`Error saving chunk ${i}:`, chunkError)
          // Decide if to continue or fail all
        }
      } else {
        console.warn(`Skipping chunk ${i} due to embedding generation failure.`)
      }
    }

    // 5. Update document status
    await supabase
      .from("documents")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", document.id)

    return { success: true, message: `Document "${document.name}" processed successfully.` }
  } catch (error) {
    console.error(`Error processing document ${document.id}:`, error)
    await supabase
      .from("documents")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", document.id)
    return { success: false, message: error instanceof Error ? error.message : "Unknown processing error." }
  }
}
