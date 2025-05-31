// app/api/process-document/route.ts - COMPLETE STREAMING VERSION

import { type NextRequest } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OpenAI } from "openai"

export const runtime = "nodejs"
// No maxDuration needed - streaming keeps connection alive

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Production-ready configuration
const CONFIG = {
  // Conservative chunk sizes for reliable processing
  MAX_CHUNK_TOKENS: 150,        
  OVERLAP_TOKENS: 30,           
  
  // File size limits
  MAX_FILE_SIZE: 100 * 1024 * 1024,    // 100MB
  MAX_TEXT_LENGTH: 10 * 1024 * 1024,   // 10MB of extracted text
  
  // Processing limits
  MAX_CHUNKS_PER_DOCUMENT: 10000,      
  BATCH_SIZE: 2,                       
  BATCH_DELAY_MS: 1500,               
  
  // Token estimation safety multipliers
  SAFETY_MULTIPLIER: 1.3,             
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
} as const

// PRODUCTION-GRADE token estimation using multiple methods
class TokenEstimator {
  private static readonly PATTERNS = {
    // Different content types have different tokenization patterns
    CODE: {
      charsPerToken: 2.8,    // Code is denser due to symbols
      wordsPerToken: 1.6,    // More technical terms
      safetyMultiplier: 1.4,
    },
    NATURAL_LANGUAGE: {
      charsPerToken: 3.5,    // More spaces and common words
      wordsPerToken: 1.3,    // Regular English
      safetyMultiplier: 1.2,
    },
    MIXED: {
      charsPerToken: 3.0,    // Between code and natural language
      wordsPerToken: 1.4,
      safetyMultiplier: 1.3,
    },
  }

  static detectContentType(text: string): keyof typeof TokenEstimator.PATTERNS {
    const codeIndicators = [
      /\b(?:function|class|import|export|const|let|var|if|else|for|while|return)\b/g,
      /[{}();[\]]/g,
      /[=<>!&|+\-*/%]/g,
    ]
    
    let codeScore = 0
    for (const pattern of codeIndicators) {
      const matches = text.match(pattern)
      codeScore += matches ? matches.length : 0
    }
    
    const words = text.split(/\s+/).length
    const codeRatio = codeScore / words
    
    if (codeRatio > 0.3) return 'CODE'
    if (codeRatio < 0.1) return 'NATURAL_LANGUAGE'
    return 'MIXED'
  }

  static estimate(text: string): number {
    if (!text || text.length === 0) return 0
    
    const contentType = this.detectContentType(text)
    const patterns = this.PATTERNS[contentType]
    
    const chars = text.length
    const words = text.split(/\s+/).filter(w => w.length > 0).length
    
    // Multiple estimation methods
    const charBasedEstimate = Math.ceil(chars / patterns.charsPerToken)
    const wordBasedEstimate = Math.ceil(words * patterns.wordsPerToken)
    
    // Use the higher estimate
    const baseEstimate = Math.max(charBasedEstimate, wordBasedEstimate)
    
    // Apply safety multiplier and global safety factor
    return Math.ceil(baseEstimate * patterns.safetyMultiplier * CONFIG.SAFETY_MULTIPLIER)
  }
}

// PRODUCTION-GRADE chunking with intelligent splitting strategies
class ProductionChunker {
  private readonly maxTokens: number
  private readonly overlapTokens: number
  private readonly documentTitle: string

  constructor(maxTokens: number, overlapTokens: number, documentTitle: string) {
    this.maxTokens = maxTokens
    this.overlapTokens = overlapTokens
    this.documentTitle = documentTitle
  }

  chunk(text: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    console.log(`Starting chunking: ${text.length} chars, target: ${this.maxTokens} tokens`)
    
    // Detect content type for optimization
    const contentType = TokenEstimator.detectContentType(text)
    console.log(`Detected content type: ${contentType}`)
    
    // Choose splitting strategy based on content type
    switch (contentType) {
      case 'CODE':
        return this.chunkCode(text, contentType)
      case 'NATURAL_LANGUAGE':
        return this.chunkNaturalLanguage(text, contentType)
      default:
        return this.chunkMixed(text, contentType)
    }
  }

  private chunkCode(text: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    
    // For code, split by logical boundaries
    const codeBlocks = this.splitByCodeBlocks(text)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const block of codeBlocks) {
      const blockTokens = TokenEstimator.estimate(block)
      
      // If single block is too large, split it further
      if (blockTokens > this.maxTokens) {
        // If we have accumulated content, save it first
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
          currentChunk = []
          currentTokens = 0
        }
        
        // Split the large block
        const subChunks = this.splitLargeBlock(block, contentType)
        chunks.push(...subChunks)
        continue
      }
      
      // Check if adding this block would exceed limit
      if (currentTokens + blockTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
        
        // Start new chunk with overlap (keep last block if small enough)
        const lastBlock = currentChunk[currentChunk.length - 1]
        const lastBlockTokens = TokenEstimator.estimate(lastBlock)
        
        if (lastBlockTokens <= this.overlapTokens) {
          currentChunk = [lastBlock]
          currentTokens = lastBlockTokens
        } else {
          currentChunk = []
          currentTokens = 0
        }
      }
      
      currentChunk.push(block)
      currentTokens += blockTokens
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
    }
    
    return chunks
  }

  private chunkNaturalLanguage(text: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    
    // Split by paragraphs first, then sentences
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = TokenEstimator.estimate(paragraph)
      
      // If single paragraph is too large, split by sentences
      if (paragraphTokens > this.maxTokens) {
        // Save current chunk if exists
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
          currentChunk = []
          currentTokens = 0
        }
        
        // Split paragraph by sentences
        const sentenceChunks = this.splitBySentences(paragraph, contentType)
        chunks.push(...sentenceChunks)
        continue
      }
      
      // Check if adding this paragraph would exceed limit
      if (currentTokens + paragraphTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
        
        // Start new chunk with minimal overlap
        currentChunk = [paragraph]
        currentTokens = paragraphTokens
      } else {
        currentChunk.push(paragraph)
        currentTokens += paragraphTokens
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
    }
    
    return chunks
  }

  private chunkMixed(text: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    // Use a hybrid approach - try natural language first, fall back to code splitting
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    
    // Split by double newlines (paragraphs/sections)
    const sections = text.split(/\n\s*\n/).filter(s => s.trim().length > 0)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const section of sections) {
      const sectionTokens = TokenEstimator.estimate(section)
      
      if (sectionTokens > this.maxTokens) {
        // Save current chunk
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
          currentChunk = []
          currentTokens = 0
        }
        
        // Determine how to split this large section
        const sectionContentType = TokenEstimator.detectContentType(section)
        if (sectionContentType === 'CODE') {
          const subChunks = this.splitLargeBlock(section, contentType)
          chunks.push(...subChunks)
        } else {
          const subChunks = this.splitBySentences(section, contentType)
          chunks.push(...subChunks)
        }
        continue
      }
      
      if (currentTokens + sectionTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
        currentChunk = [section]
        currentTokens = sectionTokens
      } else {
        currentChunk.push(section)
        currentTokens += sectionTokens
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join('\n\n'), contentType))
    }
    
    return chunks
  }

  private splitByCodeBlocks(text: string): string[] {
    // Split by common code boundaries
    const patterns = [
      /\n(?=(?:function|class|interface|type|const|let|var|import|export)\s)/g,
      /\n(?=\/\*\*?)/g,  // Comments
      /\n(?=\/\/)/g,     // Single line comments
      /\n(?=\s*\})/g,    // Closing braces
    ]
    
    let blocks = [text]
    
    for (const pattern of patterns) {
      const newBlocks: string[] = []
      for (const block of blocks) {
        if (TokenEstimator.estimate(block) <= this.maxTokens) {
          newBlocks.push(block)
        } else {
          const parts = block.split(pattern).filter(p => p.trim().length > 0)
          newBlocks.push(...parts)
        }
      }
      blocks = newBlocks
    }
    
    return blocks.filter(b => b.trim().length > 0)
  }

  private splitBySentences(text: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const sentence of sentences) {
      const sentenceTokens = TokenEstimator.estimate(sentence)
      
      if (sentenceTokens > this.maxTokens) {
        // Save current chunk
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk.join(' '), contentType))
          currentChunk = []
          currentTokens = 0
        }
        
        // Split by words as last resort
        const wordChunks = this.splitByWords(sentence, contentType)
        chunks.push(...wordChunks)
        continue
      }
      
      if (currentTokens + sentenceTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join(' '), contentType))
        
        // Overlap with last sentence if it's small
        const lastSentence = currentChunk[currentChunk.length - 1]
        const lastSentenceTokens = TokenEstimator.estimate(lastSentence)
        
        if (lastSentenceTokens <= this.overlapTokens) {
          currentChunk = [lastSentence, sentence]
          currentTokens = lastSentenceTokens + sentenceTokens
        } else {
          currentChunk = [sentence]
          currentTokens = sentenceTokens
        }
      } else {
        currentChunk.push(sentence)
        currentTokens += sentenceTokens
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join(' '), contentType))
    }
    
    return chunks
  }

  private splitLargeBlock(block: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    
    // Try splitting by lines first
    const lines = block.split('\n')
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const line of lines) {
      const lineTokens = TokenEstimator.estimate(line)
      
      if (lineTokens > this.maxTokens) {
        // Save current chunk
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
          currentChunk = []
          currentTokens = 0
        }
        
        // Split line by words
        const wordChunks = this.splitByWords(line, contentType)
        chunks.push(...wordChunks)
        continue
      }
      
      if (currentTokens + lineTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
        currentChunk = [line]
        currentTokens = lineTokens
      } else {
        currentChunk.push(line)
        currentTokens += lineTokens
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join('\n'), contentType))
    }
    
    return chunks
  }

  private splitByWords(text: string, contentType: string): Array<{content: string, context: string, tokens: number, contentType: string}> {
    const chunks: Array<{content: string, context: string, tokens: number, contentType: string}> = []
    const words = text.split(/\s+/)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const word of words) {
      const wordTokens = TokenEstimator.estimate(word)
      
      if (currentTokens + wordTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.join(' '), contentType))
        currentChunk = [word]
        currentTokens = wordTokens
      } else {
        currentChunk.push(word)
        currentTokens += wordTokens
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk.join(' '), contentType))
    }
    
    return chunks
  }

  private createChunk(content: string, contentType: string): {content: string, context: string, tokens: number, contentType: string} {
    const trimmedContent = content.trim()
    const tokens = TokenEstimator.estimate(trimmedContent)
    const context = `Document: ${this.documentTitle} (${contentType})`
    
    return {
      content: trimmedContent,
      context,
      tokens,
      contentType
    }
  }
}

// STREAMING DOCUMENT PROCESSOR with real-time updates
class StreamingDocumentProcessor {
  private supabase = createSupabaseAdminClient()
  private sendUpdate: (data: any) => void

  constructor(sendUpdate: (data: any) => void) {
    this.sendUpdate = sendUpdate
  }

  async processDocument(documentId: string, projectId: string) {
    let document: any = null
    
    try {
      this.sendUpdate({ type: 'status', message: 'Fetching document...', documentId })
      
      // 1. Fetch document
      document = await this.fetchDocument(documentId, projectId)
      
      // 2. Update status
      await this.updateDocumentStatus(documentId, 'processing')
      this.sendUpdate({ type: 'status', message: 'Extracting text...', documentId })
      
      // 3. Extract text
      const textContent = await this.extractAndValidateText(document)
      this.sendUpdate({ 
        type: 'progress', 
        step: 'extraction_complete',
        textLength: textContent.length,
        documentId
      })
      
      // 4. Create chunks
      this.sendUpdate({ type: 'status', message: 'Creating chunks...', documentId })
      const chunks = await this.createOptimizedChunks(textContent, document.name)
      this.sendUpdate({ 
        type: 'progress', 
        step: 'chunking_complete',
        totalChunks: chunks.length,
        documentId
      })
      
      // 5. Process chunks with progress updates
      const processedCount = await this.processChunksWithEmbeddings(chunks, document)
      
      // 6. Complete
      await this.updateDocumentStatus(documentId, 'completed')
      
      const avgTokens = chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length
      const contentType = chunks[0]?.contentType || 'UNKNOWN'
      
      console.log(`[${documentId}] ✅ Processing completed: ${processedCount} chunks, ${textContent.length} chars`)
      
      return {
        success: true,
        chunksCreated: processedCount,
        textLength: textContent.length,
        avgTokensPerChunk: Math.round(avgTokens),
        contentType
      }
      
    } catch (error) {
      console.error(`[${documentId}] ❌ Processing failed:`, error)
      
      if (document) {
        await this.updateDocumentStatus(documentId, 'failed').catch(console.error)
      }
      
      return {
        success: false,
        chunksCreated: 0,
        textLength: 0,
        avgTokensPerChunk: 0,
        contentType: 'UNKNOWN',
        error: error.message
      }
    }
  }

  private async fetchDocument(documentId: string, projectId: string) {
    const { data: document, error } = await this.supabase
      .from("documents")
      .select("id, file_url, mime_type, user_id, project_id, name, file_size")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .single()

    if (error || !document) {
      throw new Error(`Document not found: ${error?.message || 'Unknown error'}`)
    }

    return document
  }

  private async updateDocumentStatus(documentId: string, status: string) {
    const { error } = await this.supabase
      .from("documents")
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", documentId)

    if (error) {
      console.error(`Failed to update document status to ${status}:`, error)
    }
  }

  private async extractAndValidateText(document: any): Promise<string> {
    if (!document.file_url || !document.mime_type) {
      throw new Error("Document URL or MIME type missing")
    }

    // Check file size before processing
    if (document.file_size && document.file_size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(document.file_size / 1024 / 1024)}MB. Maximum: ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`)
    }

    console.log(`[${document.id}] Extracting text from ${document.mime_type}`)
    
    const textContent = await this.extractTextFromFile(document.file_url, document.mime_type)
    
    // Validate extracted text size
    if (textContent.length > CONFIG.MAX_TEXT_LENGTH) {
      throw new Error(`Extracted text too large: ${Math.round(textContent.length / 1024 / 1024)}MB. Maximum: ${Math.round(CONFIG.MAX_TEXT_LENGTH / 1024 / 1024)}MB`)
    }

    if (!textContent.trim()) {
      throw new Error("No text content could be extracted from the file")
    }

    console.log(`[${document.id}] Extracted ${textContent.length} characters`)
    return textContent
  }

  private async createOptimizedChunks(textContent: string, documentName: string) {
    const chunker = new ProductionChunker(
      CONFIG.MAX_CHUNK_TOKENS,
      CONFIG.OVERLAP_TOKENS,
      documentName || "Unknown Document"
    )

    const chunks = chunker.chunk(textContent)

    // Validate chunk count
    if (chunks.length > CONFIG.MAX_CHUNKS_PER_DOCUMENT) {
      throw new Error(`Too many chunks: ${chunks.length}. Maximum: ${CONFIG.MAX_CHUNKS_PER_DOCUMENT}. Try a smaller file.`)
    }

    // Validate no chunk exceeds OpenAI limits
    const oversizedChunks = chunks.filter(c => c.tokens > 8000)
    if (oversizedChunks.length > 0) {
      throw new Error(`${oversizedChunks.length} chunks exceed OpenAI token limits`)
    }

    console.log(`Created ${chunks.length} chunks, max tokens: ${Math.max(...chunks.map(c => c.tokens))}`)
    return chunks
  }

  // Enhanced chunk processing with real-time progress updates
  private async processChunksWithEmbeddings(chunks: any[], document: any): Promise<number> {
    let processedCount = 0
    const totalBatches = Math.ceil(chunks.length / CONFIG.BATCH_SIZE)

    for (let i = 0; i < chunks.length; i += CONFIG.BATCH_SIZE) {
      const batch = chunks.slice(i, i + CONFIG.BATCH_SIZE)
      const batchNumber = Math.floor(i / CONFIG.BATCH_SIZE) + 1
      
      this.sendUpdate({ 
        type: 'progress', 
        step: 'processing_batch',
        batchNumber,
        totalBatches,
        processed: processedCount,
        total: chunks.length,
        documentId: document.id
      })

      await this.processBatchWithRetries(batch, document, i)
      processedCount += batch.length

      // Progress update after each batch
      this.sendUpdate({ 
        type: 'progress', 
        step: 'batch_complete',
        processed: processedCount,
        total: chunks.length,
        percentage: Math.round((processedCount / chunks.length) * 100),
        documentId: document.id
      })

      // Rate limiting delay
      if (i + CONFIG.BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY_MS))
      }
    }

    return processedCount
  }

  private async processBatchWithRetries(batch: any[], document: any, startIndex: number) {
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        await this.processBatch(batch, document, startIndex)
        return // Success
      } catch (error) {
        console.error(`[${document.id}] Batch attempt ${attempt} failed:`, error.message)
        
        this.sendUpdate({ 
          type: 'warning', 
          message: `Batch attempt ${attempt} failed, retrying...`,
          documentId: document.id
        })
        
        if (attempt === CONFIG.MAX_RETRIES) {
          throw error // Final attempt failed
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS * attempt))
      }
    }
  }

  private async processBatch(batch: any[], document: any, startIndex: number) {
    const batchPromises = batch.map(async (chunk, batchIndex) => {
      const chunkIndex = startIndex + batchIndex
      
      try {
        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.content,
        })
        
        const embedding = embeddingResponse.data[0].embedding

        // Store chunk
        const { error: insertError } = await this.supabase
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
          throw new Error(`Database insert failed: ${insertError.message}`)
        }

        console.log(`[${document.id}] ✓ Chunk ${chunkIndex + 1} processed (${chunk.tokens} tokens)`)
        
      } catch (error) {
        console.error(`[${document.id}] ✗ Chunk ${chunkIndex + 1} failed:`, error.message)
        throw error
      }
    })

    await Promise.all(batchPromises)
  }

  private async extractTextFromFile(fileUrl: string, mimeType: string): Promise<string> {
    try {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
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
    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`)
    }
  }
}

// MAIN STREAMING API ENDPOINT
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: OpenAI API key missing" }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { documentId, projectId } = body

    if (!documentId || !projectId) {
      return new Response(
        JSON.stringify({ error: "Document ID and Project ID are required" }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const sendUpdate = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        }

        try {
          sendUpdate({ 
            type: 'start', 
            message: 'Starting document processing...', 
            documentId,
            timestamp: new Date().toISOString()
          })

          const processor = new StreamingDocumentProcessor(sendUpdate)
          const result = await processor.processDocument(documentId, projectId)

          if (result.success) {
            sendUpdate({ 
              type: 'complete', 
              message: 'Document processing completed successfully!',
              documentId,
              chunksCreated: result.chunksCreated,
              textLength: result.textLength,
              avgTokensPerChunk: result.avgTokensPerChunk,
              contentType: result.contentType,
              timestamp: new Date().toISOString()
            })
          } else {
            sendUpdate({ 
              type: 'error', 
              message: 'Document processing failed',
              documentId,
              error: result.error,
              timestamp: new Date().toISOString()
            })
          }

        } catch (error) {
          console.error("Streaming processing error:", error)
          sendUpdate({ 
            type: 'error', 
            message: 'Fatal processing error',
            documentId,
            error: error.message,
            timestamp: new Date().toISOString()
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error("API Error:", error)
    return new Response(
      JSON.stringify({ error: `Document processing failed: ${error.message}` }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
