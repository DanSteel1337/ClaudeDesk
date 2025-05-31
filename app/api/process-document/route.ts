import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OpenAI } from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ACCURATE token counting using gpt-tokenizer (matches OpenAI exactly)
// npm install gpt-tokenizer
let gptTokenizer: any = null

async function getTokenizer() {
  if (!gptTokenizer) {
    // Import gpt-tokenizer for cl100k_base encoding (used by text-embedding-3-small)
    const { encode } = await import('gpt-tokenizer/encoding/cl100k_base')
    gptTokenizer = { encode }
  }
  return gptTokenizer
}

// ACCURATE token counting - matches OpenAI exactly
async function getAccurateTokenCount(text: string): Promise<number> {
  const tokenizer = await getTokenizer()
  return tokenizer.encode(text).length
}

// ADAPTIVE configuration based on file size and content type
class AdaptiveConfig {
  static getConfig(textLength: number, contentType: 'CODE' | 'NATURAL_LANGUAGE' | 'MIXED' | 'UNKNOWN') {
    // Small files (< 50K chars): Prioritize accuracy
    if (textLength < 50000) {
      return {
        MAX_CHUNK_TOKENS: 400,
        OVERLAP_TOKENS: 80,
        BATCH_SIZE: 5,
        MAX_PARALLEL_BATCHES: 2,
        BATCH_DELAY_MS: 500,
        PROCESSING_STRATEGY: 'ACCURACY_FIRST'
      }
    }
    
    // Medium files (50K - 500K chars): Balance accuracy and speed
    if (textLength < 500000) {
      return {
        MAX_CHUNK_TOKENS: 350,
        OVERLAP_TOKENS: 60,
        BATCH_SIZE: 8,
        MAX_PARALLEL_BATCHES: 3,
        BATCH_DELAY_MS: 300,
        PROCESSING_STRATEGY: 'BALANCED'
      }
    }
    
    // Large files (500K - 2M chars): Prioritize speed
    if (textLength < 2000000) {
      return {
        MAX_CHUNK_TOKENS: 300,
        OVERLAP_TOKENS: 50,
        BATCH_SIZE: 12,
        MAX_PARALLEL_BATCHES: 4,
        BATCH_DELAY_MS: 200,
        PROCESSING_STRATEGY: 'SPEED_OPTIMIZED'
      }
    }
    
    // Massive files (2M+ chars): Maximum parallelization
    return {
      MAX_CHUNK_TOKENS: 250,
      OVERLAP_TOKENS: 40,
      BATCH_SIZE: 15,
      MAX_PARALLEL_BATCHES: 5,
      BATCH_DELAY_MS: 150,
      PROCESSING_STRATEGY: 'MAXIMUM_THROUGHPUT'
    }
  }
}

// INTELLIGENT content type detection
class ContentAnalyzer {
  static analyzeContent(text: string): {
    type: 'CODE' | 'NATURAL_LANGUAGE' | 'MIXED' | 'UNKNOWN',
    confidence: number,
    characteristics: {
      codeRatio: number,
      naturalLanguageRatio: number,
      structureComplexity: number
    }
  } {
    const sampleSize = Math.min(10000, text.length) // Analyze first 10K chars for speed
    const sample = text.slice(0, sampleSize)
    
    // Code indicators with weights
    const codePatterns = [
      { pattern: /\b(?:function|class|import|export|const|let|var|if|else|for|while|return|def|async|await)\b/g, weight: 3 },
      { pattern: /[{}();[\]]/g, weight: 2 },
      { pattern: /[=<>!&|+\-*/%^~]/g, weight: 1 },
      { pattern: /\/\*[\s\S]*?\*\/|\/\/.*$/gm, weight: 2 }, // Comments
      { pattern: /^\s*#.*$/gm, weight: 2 }, // Hash comments
      { pattern: /\b(?:int|str|bool|float|double|char|void|null|undefined|true|false)\b/g, weight: 2 }
    ]
    
    // Natural language indicators
    const naturalLanguagePatterns = [
      { pattern: /\b(?:the|and|or|but|however|therefore|because|although|moreover|furthermore)\b/gi, weight: 2 },
      { pattern: /[.!?]+\s+[A-Z]/g, weight: 3 }, // Sentence boundaries
      { pattern: /\b(?:is|are|was|were|will|would|could|should|can|may|might)\b/gi, weight: 1 },
      { pattern: /[,;:]\s/g, weight: 1 }
    ]
    
    let codeScore = 0
    let nlScore = 0
    
    // Calculate code score
    for (const { pattern, weight } of codePatterns) {
      const matches = sample.match(pattern) || []
      codeScore += matches.length * weight
    }
    
    // Calculate natural language score
    for (const { pattern, weight } of naturalLanguagePatterns) {
      const matches = sample.match(pattern) || []
      nlScore += matches.length * weight
    }
    
    // Normalize scores
    const totalChars = sample.length
    const codeRatio = codeScore / totalChars
    const naturalLanguageRatio = nlScore / totalChars
    
    // Structure complexity (indentation, nesting)
    const lines = sample.split('\n')
    const avgIndentation = lines.reduce((sum, line) => {
      const leadingSpaces = line.match(/^\s*/)?.[0].length || 0
      return sum + leadingSpaces
    }, 0) / lines.length
    
    const structureComplexity = avgIndentation / 10 // Normalize
    
    // Determine content type
    let type: 'CODE' | 'NATURAL_LANGUAGE' | 'MIXED' | 'UNKNOWN'
    let confidence: number
    
    if (codeRatio > 0.3 && codeRatio > naturalLanguageRatio * 2) {
      type = 'CODE'
      confidence = Math.min(0.95, codeRatio / 0.3)
    } else if (naturalLanguageRatio > 0.2 && naturalLanguageRatio > codeRatio * 2) {
      type = 'NATURAL_LANGUAGE'
      confidence = Math.min(0.95, naturalLanguageRatio / 0.2)
    } else if (codeRatio > 0.1 || naturalLanguageRatio > 0.1) {
      type = 'MIXED'
      confidence = 0.7
    } else {
      type = 'UNKNOWN'
      confidence = 0.3
    }
    
    return {
      type,
      confidence,
      characteristics: {
        codeRatio,
        naturalLanguageRatio,
        structureComplexity
      }
    }
  }
}

// SEMANTIC-AWARE chunking that preserves meaning and leverages hybrid search
class SemanticChunker {
  private config: any
  private documentTitle: string
  private contentAnalysis: any

  constructor(config: any, documentTitle: string, contentAnalysis: any) {
    this.config = config
    this.documentTitle = documentTitle
    this.contentAnalysis = contentAnalysis
  }

  async chunkIntelligently(text: string): Promise<Array<{
    content: string
    context: string
    tokens: number
    semanticBoundary: string
    chunkType: string
  }>> {
    console.log(`🧠 Semantic chunking: ${text.length} chars, type: ${this.contentAnalysis.type}`)
    
    switch (this.contentAnalysis.type) {
      case 'CODE':
        return await this.chunkCode(text)
      case 'NATURAL_LANGUAGE':
        return await this.chunkNaturalLanguage(text)
      case 'MIXED':
        return await this.chunkMixed(text)
      default:
        return await this.chunkFallback(text)
    }
  }

  private async chunkCode(text: string) {
    const chunks: any[] = []
    
    // Split by logical code boundaries
    const codeBlocks = this.extractCodeBlocks(text)
    
    let currentChunk: any[] = []
    let currentTokens = 0
    
    for (const block of codeBlocks) {
      const blockTokens = await getAccurateTokenCount(block.content)
      
      // If single block exceeds limit, split it
      if (blockTokens > this.config.MAX_CHUNK_TOKENS) {
        // Save current chunk if exists
        if (currentChunk.length > 0) {
          chunks.push(await this.createSemanticChunk(currentChunk, 'CODE_BLOCK_GROUP'))
          currentChunk = []
          currentTokens = 0
        }
        
        // Split large block hierarchically
        const subChunks = await this.splitLargeCodeBlock(block)
        chunks.push(...subChunks)
        continue
      }
      
      // Check if adding block exceeds limit
      if (currentTokens + blockTokens > this.config.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        chunks.push(await this.createSemanticChunk(currentChunk, 'CODE_BLOCK_GROUP'))
        
        // Smart overlap: include related blocks
        const overlapBlocks = this.selectOverlapBlocks(currentChunk, blockTokens)
        currentChunk = [...overlapBlocks, block]
        currentTokens = await getAccurateTokenCount(currentChunk.map(b => b.content).join('\n'))
      } else {
        currentChunk.push(block)
        currentTokens += blockTokens
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(await this.createSemanticChunk(currentChunk, 'CODE_BLOCK_GROUP'))
    }
    
    return chunks
  }

  private async chunkNaturalLanguage(text: string) {
    const chunks: any[] = []
    
    // Extract semantic units (paragraphs, sections)
    const semanticUnits = this.extractSemanticUnits(text)
    
    let currentChunk: any[] = []
    let currentTokens = 0
    
    for (const unit of semanticUnits) {
      const unitTokens = await getAccurateTokenCount(unit.content)
      
      // If single unit is too large, split by sentences
      if (unitTokens > this.config.MAX_CHUNK_TOKENS) {
        if (currentChunk.length > 0) {
          chunks.push(await this.createSemanticChunk(currentChunk, 'PARAGRAPH_GROUP'))
          currentChunk = []
          currentTokens = 0
        }
        
        const sentenceChunks = await this.splitBySentences(unit.content, unit.type)
        chunks.push(...sentenceChunks)
        continue
      }
      
      if (currentTokens + unitTokens > this.config.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        chunks.push(await this.createSemanticChunk(currentChunk, 'PARAGRAPH_GROUP'))
        
        // Contextual overlap for semantic coherence
        const contextUnit = this.createContextualOverlap(currentChunk, unit)
        currentChunk = contextUnit ? [contextUnit, unit] : [unit]
        currentTokens = await getAccurateTokenCount(currentChunk.map(u => u.content).join('\n\n'))
      } else {
        currentChunk.push(unit)
        currentTokens += unitTokens
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(await this.createSemanticChunk(currentChunk, 'PARAGRAPH_GROUP'))
    }
    
    return chunks
  }

  private async chunkMixed(text: string) {
    // Identify sections and chunk each appropriately
    const sections = this.identifyMixedSections(text)
    const chunks: any[] = []
    
    for (const section of sections) {
      if (section.type === 'CODE') {
        const codeChunks = await this.chunkCode(section.content)
        chunks.push(...codeChunks)
      } else {
        const textChunks = await this.chunkNaturalLanguage(section.content)
        chunks.push(...textChunks)
      }
    }
    
    return chunks
  }

  private async chunkFallback(text: string) {
    // Safe fallback: sentence-based chunking
    return await this.splitBySentences(text, 'UNKNOWN')
  }

  // HELPER METHODS

  private extractCodeBlocks(text: string) {
    const blocks: any[] = []
    
    // Split by function/class definitions
    const functionRegex = /(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+\w+[\s\S]*?(?=\n(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+\w+|\n\s*$|$)/gm
    
    let lastIndex = 0
    let match
    
    while ((match = functionRegex.exec(text)) !== null) {
      // Add content before this block if significant
      if (match.index > lastIndex) {
        const beforeContent = text.slice(lastIndex, match.index).trim()
        if (beforeContent.length > 50) {
          blocks.push({
            content: beforeContent,
            type: 'CODE_FRAGMENT',
            startLine: this.getLineNumber(text, lastIndex)
          })
        }
      }
      
      blocks.push({
        content: match[0].trim(),
        type: 'FUNCTION_OR_CLASS',
        startLine: this.getLineNumber(text, match.index)
      })
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining content
    if (lastIndex < text.length) {
      const remainingContent = text.slice(lastIndex).trim()
      if (remainingContent.length > 50) {
        blocks.push({
          content: remainingContent,
          type: 'CODE_FRAGMENT',
          startLine: this.getLineNumber(text, lastIndex)
        })
      }
    }
    
    return blocks.length > 0 ? blocks : [{ content: text, type: 'SINGLE_BLOCK', startLine: 1 }]
  }

  private extractSemanticUnits(text: string) {
    const units: any[] = []
    
    // Split by headers and paragraphs
    const sections = text.split(/\n\s*\n/)
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim()
      if (section.length < 20) continue // Skip very short sections
      
      // Detect section type
      let type = 'PARAGRAPH'
      if (section.match(/^#+\s/)) type = 'HEADER'
      else if (section.match(/^\d+\./)) type = 'NUMBERED_LIST'
      else if (section.match(/^[-*]\s/)) type = 'BULLET_LIST'
      else if (section.length > 500) type = 'LONG_PARAGRAPH'
      
      units.push({
        content: section,
        type,
        index: i
      })
    }
    
    return units
  }

  private identifyMixedSections(text: string) {
    const sections: any[] = []
    const lines = text.split('\n')
    
    let currentSection = { content: '', type: 'UNKNOWN', startLine: 0 }
    let consecutiveCodeLines = 0
    let consecutiveTextLines = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Detect if line is code-like
      const isCodeLine = /[{}();[\]=<>!&|+\-*/%]/.test(line) || 
                        /^\s*(function|class|import|export|const|let|var|if|else|for|while|return)/.test(line)
      
      if (isCodeLine) {
        consecutiveCodeLines++
        consecutiveTextLines = 0
        
        if (currentSection.type === 'TEXT' && currentSection.content.trim()) {
          sections.push({ ...currentSection })
          currentSection = { content: line + '\n', type: 'CODE', startLine: i }
        } else {
          currentSection.content += line + '\n'
          currentSection.type = 'CODE'
        }
      } else {
        consecutiveTextLines++
        consecutiveCodeLines = 0
        
        if (currentSection.type === 'CODE' && currentSection.content.trim()) {
          sections.push({ ...currentSection })
          currentSection = { content: line + '\n', type: 'TEXT', startLine: i }
        } else {
          currentSection.content += line + '\n'
          currentSection.type = 'TEXT'
        }
      }
    }
    
    if (currentSection.content.trim()) {
      sections.push(currentSection)
    }
    
    return sections
  }

  private async splitBySentences(text: string, sectionType: string) {
    const chunks: any[] = []
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const sentence of sentences) {
      const sentenceTokens = await getAccurateTokenCount(sentence)
      
      if (currentTokens + sentenceTokens > this.config.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        const content = currentChunk.join(' ')
        chunks.push({
          content: content.trim(),
          context: `Document: ${this.documentTitle} (${sectionType})`,
          tokens: await getAccurateTokenCount(content),
          semanticBoundary: 'SENTENCE',
          chunkType: sectionType
        })
        
        // Smart overlap
        const overlapSentences = Math.min(2, currentChunk.length)
        currentChunk = currentChunk.slice(-overlapSentences)
        currentTokens = await getAccurateTokenCount(currentChunk.join(' '))
      }
      
      currentChunk.push(sentence)
      currentTokens += sentenceTokens
    }
    
    if (currentChunk.length > 0) {
      const content = currentChunk.join(' ')
      chunks.push({
        content: content.trim(),
        context: `Document: ${this.documentTitle} (${sectionType})`,
        tokens: await getAccurateTokenCount(content),
        semanticBoundary: 'SENTENCE',
        chunkType: sectionType
      })
    }
    
    return chunks
  }

  private async createSemanticChunk(units: any[], chunkType: string) {
    const content = units.map(u => u.content).join(chunkType.includes('CODE') ? '\n' : '\n\n')
    const tokens = await getAccurateTokenCount(content)
    
    // Rich context for better RAG performance
    const contextParts = [
      `Document: ${this.documentTitle}`,
      `Type: ${this.contentAnalysis.type}`,
      `Section: ${chunkType}`
    ]
    
    if (units[0]?.type) {
      contextParts.push(`Content: ${units[0].type}`)
    }
    
    if (units[0]?.startLine) {
      contextParts.push(`Lines: ${units[0].startLine}-${units[units.length - 1]?.startLine || units[0].startLine}`)
    }
    
    return {
      content: content.trim(),
      context: contextParts.join(' | '),
      tokens,
      semanticBoundary: chunkType,
      chunkType: this.contentAnalysis.type
    }
  }

  private selectOverlapBlocks(currentChunk: any[], nextBlockTokens: number) {
    const targetOverlapTokens = this.config.OVERLAP_TOKENS
    let overlapTokens = 0
    const overlapBlocks = []
    
    // Select from end of current chunk
    for (let i = currentChunk.length - 1; i >= 0 && overlapTokens < targetOverlapTokens; i--) {
      overlapBlocks.unshift(currentChunk[i])
      overlapTokens += currentChunk[i].tokens || 50 // Estimate if not available
    }
    
    return overlapBlocks
  }

  private createContextualOverlap(currentChunk: any[], nextUnit: any) {
    // Create a summary or key context from current chunk
    const lastUnit = currentChunk[currentChunk.length - 1]
    if (!lastUnit) return null
    
    // For natural language, try to create semantic bridge
    if (lastUnit.content.length < 200) {
      return lastUnit
    }
    
    // Extract last sentence or key phrase
    const sentences = lastUnit.content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const lastSentence = sentences[sentences.length - 1]
    
    if (lastSentence && lastSentence.length < 150) {
      return {
        content: lastSentence.trim(),
        type: 'CONTEXT_BRIDGE',
        index: lastUnit.index
      }
    }
    
    return null
  }

  private async splitLargeCodeBlock(block: any) {
    // Split large code blocks by logical boundaries
    const lines = block.content.split('\n')
    const chunks: any[] = []
    
    let currentChunk: string[] = []
    let currentTokens = 0
    
    for (const line of lines) {
      const lineTokens = await getAccurateTokenCount(line)
      
      if (currentTokens + lineTokens > this.config.MAX_CHUNK_TOKENS && currentChunk.length > 0) {
        const content = currentChunk.join('\n')
        chunks.push({
          content: content.trim(),
          context: `Document: ${this.documentTitle} | Code Block | Lines: ${block.startLine}`,
          tokens: await getAccurateTokenCount(content),
          semanticBoundary: 'CODE_LINES',
          chunkType: 'CODE'
        })
        
        currentChunk = [line]
        currentTokens = lineTokens
      } else {
        currentChunk.push(line)
        currentTokens += lineTokens
      }
    }
    
    if (currentChunk.length > 0) {
      const content = currentChunk.join('\n')
      chunks.push({
        content: content.trim(),
        context: `Document: ${this.documentTitle} | Code Block | Lines: ${block.startLine}`,
        tokens: await getAccurateTokenCount(content),
        semanticBoundary: 'CODE_LINES',
        chunkType: 'CODE'
      })
    }
    
    return chunks
  }

  private getLineNumber(text: string, position: number): number {
    return text.slice(0, position).split('\n').length
  }
}

// ULTRA-HIGH-PERFORMANCE parallel processor
class UltraHighPerformanceProcessor {
  private supabase = createSupabaseAdminClient()
  private document: any
  private config: any

  constructor(document: any, config: any) {
    this.document = document
    this.config = config
  }

  async processAllChunks(chunks: any[]): Promise<number> {
    console.log(`🚀 ULTRA-HIGH-PERFORMANCE: Processing ${chunks.length} chunks`)
    console.log(`📊 Config: ${this.config.BATCH_SIZE} per batch, ${this.config.MAX_PARALLEL_BATCHES} parallel batches`)
    
    const startTime = Date.now()
    let processedCount = 0
    
    // Create batch groups for parallel processing
    const batchGroups: any[][] = []
    for (let i = 0; i < chunks.length; i += this.config.BATCH_SIZE * this.config.MAX_PARALLEL_BATCHES) {
      const batchGroup: any[][] = []
      
      for (let j = 0; j < this.config.MAX_PARALLEL_BATCHES && i + j * this.config.BATCH_SIZE < chunks.length; j++) {
        const startIdx = i + j * this.config.BATCH_SIZE
        const endIdx = Math.min(startIdx + this.config.BATCH_SIZE, chunks.length)
        batchGroup.push(chunks.slice(startIdx, endIdx))
      }
      
      batchGroups.push(batchGroup)
    }
    
    console.log(`📦 Created ${batchGroups.length} batch groups`)
    
    // Process batch groups sequentially, batches within group in parallel
    for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
      const batchGroup = batchGroups[groupIndex]
      console.log(`⚡ Processing batch group ${groupIndex + 1}/${batchGroups.length} (${batchGroup.length} parallel batches)`)
      
      // Process all batches in group simultaneously
      const batchPromises = batchGroup.map(async (batch, batchIndex) => {
        const globalBatchIndex = groupIndex * this.config.MAX_PARALLEL_BATCHES + batchIndex
        return await this.processBatchWithRetries(batch, globalBatchIndex)
      })
      
      try {
        const results = await Promise.all(batchPromises)
        const groupProcessed = results.reduce((sum, count) => sum + count, 0)
        processedCount += groupProcessed
        
        const progress = Math.round((processedCount / chunks.length) * 100)
        const elapsed = Date.now() - startTime
        const rate = Math.round((processedCount / elapsed) * 1000)
        
        console.log(`📊 Progress: ${processedCount}/${chunks.length} (${progress}%) | Rate: ${rate} chunks/sec`)
        
        // Adaptive delay based on performance
        if (groupIndex < batchGroups.length - 1) {
          const adaptiveDelay = this.calculateAdaptiveDelay(rate, this.config.PROCESSING_STRATEGY)
          if (adaptiveDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay))
          }
        }
        
      } catch (error) {
        console.error(`❌ Batch group ${groupIndex + 1} failed:`, error)
        throw error
      }
    }
    
    const totalTime = Date.now() - startTime
    const finalRate = Math.round((processedCount / totalTime) * 1000)
    console.log(`🎉 ULTRA-PERFORMANCE COMPLETE: ${processedCount} chunks in ${totalTime}ms (${finalRate} chunks/sec)`)
    
    return processedCount
  }

  private calculateAdaptiveDelay(currentRate: number, strategy: string): number {
    // Adjust delay based on current performance and strategy
    switch (strategy) {
      case 'ACCURACY_FIRST':
        return this.config.BATCH_DELAY_MS
      case 'BALANCED':
        return currentRate > 10 ? this.config.BATCH_DELAY_MS / 2 : this.config.BATCH_DELAY_MS
      case 'SPEED_OPTIMIZED':
        return currentRate > 20 ? 50 : this.config.BATCH_DELAY_MS / 2
      case 'MAXIMUM_THROUGHPUT':
        return currentRate > 30 ? 0 : 100
      default:
        return this.config.BATCH_DELAY_MS
    }
  }

  private async processBatchWithRetries(batch: any[], batchIndex: number): Promise<number> {
    const maxRetries = 3
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processBatch(batch, batchIndex)
      } catch (error) {
        console.error(`❌ Batch ${batchIndex} attempt ${attempt}/${maxRetries} failed:`, error.message)
        
        if (attempt === maxRetries) {
          throw error
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    return 0
  }

  private async processBatch(batch: any[], batchIndex: number): Promise<number> {
    // Process all chunks in batch simultaneously
    const chunkPromises = batch.map(async (chunk, chunkIndex) => {
      const globalIndex = batchIndex * this.config.BATCH_SIZE + chunkIndex
      
      try {
        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.content,
        })
        
        const embedding = embeddingResponse.data[0].embedding

        // Store with enhanced metadata for hybrid search
        const { error: insertError } = await this.supabase
          .from("document_chunks")
          .insert({
            document_id: this.document.id,
            user_id: this.document.user_id,
            project_id: this.document.project_id,
            content: chunk.content,
            context: chunk.context,
            embedding: embedding,
            chunk_index: globalIndex,
            tokens: chunk.tokens,
            // Enhanced metadata for better search
            metadata: {
              semanticBoundary: chunk.semanticBoundary,
              chunkType: chunk.chunkType,
              contentLength: chunk.content.length
            }
          })

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`)
        }

        return globalIndex

      } catch (error) {
        console.error(`❌ Chunk ${globalIndex} failed:`, error.message)
        throw error
      }
    })

    await Promise.all(chunkPromises)
    return batch.length
  }
}

// MAIN ULTIMATE ENDPOINT
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let documentId = "unknown"
  
  try {
    console.log("🚀 ULTIMATE PRODUCTION MODE: Starting...")
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key missing" }, 
        { status: 500 }
      )
    }

    const body = await request.json()
    documentId = body.documentId
    const projectId = body.projectId

    if (!documentId || !projectId) {
      return NextResponse.json(
        { error: "Document ID and Project ID required" }, 
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // 1. Fetch document and update status in parallel
    console.log(`📄 Fetching document ${documentId}...`)
    const [documentResult, _] = await Promise.all([
      supabase
        .from("documents")
        .select("id, file_url, mime_type, user_id, project_id, name, file_size")
        .eq("id", documentId)
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("documents")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", documentId)
    ])

    const { data: document, error: docError } = documentResult
    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`)
    }

    console.log(`✅ Document: ${document.name} (${Math.round((document.file_size || 0) / 1024)}KB)`)

    // 2. Extract text
    console.log(`📄 Extracting text from ${document.mime_type}...`)
    const textContent = await extractTextOptimized(document.file_url, document.mime_type)
    console.log(`✅ Extracted ${textContent.length} characters`)

    if (!textContent.trim()) {
      throw new Error("No text content extracted")
    }

    // 3. Analyze content and get adaptive configuration
    console.log(`🧠 Analyzing content...`)
    const contentAnalysis = ContentAnalyzer.analyzeContent(textContent)
    const config = AdaptiveConfig.getConfig(textContent.length, contentAnalysis.type)
    
    console.log(`📊 Content: ${contentAnalysis.type} (${Math.round(contentAnalysis.confidence * 100)}% confidence)`)
    console.log(`⚙️ Strategy: ${config.PROCESSING_STRATEGY}`)
    console.log(`🔧 Config: ${config.MAX_CHUNK_TOKENS} tokens/chunk, ${config.BATCH_SIZE}x${config.MAX_PARALLEL_BATCHES} parallelization`)

    // 4. Semantic chunking
    console.log(`🔧 Semantic chunking...`)
    const chunker = new SemanticChunker(config, document.name || "Unknown Document", contentAnalysis)
    const chunks = await chunker.chunkIntelligently(textContent)
    
    if (chunks.length === 0) {
      throw new Error("No chunks created")
    }

    // Validate chunks
    const tokenStats = {
      min: Math.min(...chunks.map(c => c.tokens)),
      max: Math.max(...chunks.map(c => c.tokens)),
      avg: Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length)
    }
    
    console.log(`📊 Created ${chunks.length} chunks | Token stats: ${tokenStats.min}-${tokenStats.max} (avg: ${tokenStats.avg})`)
    
    // Safety check
    const oversizedChunks = chunks.filter(c => c.tokens > 500)
    if (oversizedChunks.length > 0) {
      console.warn(`⚠️ ${oversizedChunks.length} chunks exceed 500 tokens (max: ${Math.max(...oversizedChunks.map(c => c.tokens))})`)
    }

    // 5. Ultra-high-performance processing
    console.log(`⚡ Starting ultra-high-performance processing...`)
    const processor = new UltraHighPerformanceProcessor(document, config)
    const processedCount = await processor.processAllChunks(chunks)

    // 6. Complete
    await supabase
      .from("documents")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", documentId)

    const totalTime = Date.now() - startTime
    const performance = {
      charsPerSecond: Math.round(textContent.length / (totalTime / 1000)),
      chunksPerSecond: Math.round(processedCount / (totalTime / 1000)),
      tokensPerSecond: Math.round((chunks.reduce((sum, c) => sum + c.tokens, 0)) / (totalTime / 1000))
    }
    
    console.log(`🎉 ULTIMATE PRODUCTION COMPLETE!`)
    console.log(`📊 ${processedCount} chunks, ${textContent.length} chars in ${totalTime}ms`)
    console.log(`⚡ Performance: ${performance.charsPerSecond} chars/sec, ${performance.chunksPerSecond} chunks/sec`)

    return NextResponse.json({
      message: "Ultimate production processing completed",
      documentId,
      chunksCreated: processedCount,
      textLength: textContent.length,
      processingTimeMs: totalTime,
      contentAnalysis: {
        type: contentAnalysis.type,
        confidence: contentAnalysis.confidence
      },
      chunkStats: tokenStats,
      performance,
      strategy: config.PROCESSING_STRATEGY
    })

  } catch (error) {
    console.error(`❌ ULTIMATE PRODUCTION ERROR:`, error)
    
    try {
      const supabase = createSupabaseAdminClient()
      await supabase
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", documentId)
    } catch (statusError) {
      console.error("Failed to update status:", statusError)
    }
    
    return NextResponse.json(
      { error: `Processing failed: ${error.message}` }, 
      { status: 500 }
    )
  }
}

// OPTIMIZED text extraction
async function extractTextOptimized(fileUrl: string, mimeType: string): Promise<string> {
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }

  switch (mimeType) {
    case "text/plain":
    case "text/csv":
      return await response.text()
      
    case "application/pdf": {
      const pdfParse = await import('pdf-parse/lib/pdf-parse.js')
      const arrayBuffer = await response.arrayBuffer()
      const data = await pdfParse.default(Buffer.from(arrayBuffer))
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
