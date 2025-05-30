// Refactor this existing API route
import { type NextRequest, NextResponse } from "next/server"
import { StreamingTextResponse } from "ai"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server" // Standard server client
import { createClient as createAdminClient } from "@/lib/supabase/client" // Admin client for RAG
import { OpenAI } from "openai" // For embeddings if needed here, or assume embeddings exist
import { decryptApiKey } from "@/lib/encryption"

export const runtime = "edge"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function getAnthropicApiKey(userId: string, supabaseClient: any): Promise<string | null> {
  const { data: userSettings, error } = await supabaseClient
    .from("user_settings")
    .select("anthropic_api_key")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116: 0 rows, which is a valid case
    console.error("Error fetching API key from user_settings:", error)
    return null // Treat as key not found
  }
  if (!userSettings?.anthropic_api_key) {
    console.warn("Anthropic API key not found for user:", userId)
    return null
  }

  try {
    const decryptedKey = await decryptApiKey(userSettings.anthropic_api_key)
    return decryptedKey
  } catch (decryptionError) {
    console.error("Failed to decrypt API key for chat:", decryptionError)
    // Do not return the error message to the client directly for security.
    // The calling function will return a generic "API key not configured or invalid"
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient() // User-context client
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message, chatThreadId, projectId, model: requestedModel, history } = await req.json()

    if (!message || !chatThreadId || !projectId) {
      return NextResponse.json({ error: "Missing message, chatThreadId, or projectId" }, { status: 400 })
    }

    const anthropicApiKey = await getAnthropicApiKey(user.id, supabase)
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured or is invalid. Please check your settings." },
        { status: 403 }, // 403 Forbidden is appropriate here
      )
    }
    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    // 1. RAG: Fetch relevant document chunks for the projectId
    const supabaseAdmin = createAdminClient() // Use admin for vector search if RLS restricts user
    let contextText = ""
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: message,
      })
      const queryEmbedding = embeddingResponse.data[0].embedding

      const { data: chunks, error: matchError } = await supabaseAdmin.rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Adjust as needed
        match_count: 5, // Adjust as needed
        filter_user_id: user.id, // Ensure RLS or explicit filter
        filter_project_id: projectId, // Scope by project
      })

      if (matchError) {
        console.error("Error matching document chunks:", matchError)
        // Proceed without context or return error? For now, proceed.
      }

      if (chunks && chunks.length > 0) {
        contextText = chunks.map((chunk: any) => chunk.content).join("\n\n")
      }
    } catch (ragError) {
      console.error("Error during RAG embedding/matching:", ragError)
      // Proceed without context
    }

    const systemPrompt = `You are a helpful AI assistant. Use the following context from documents related to the current project to answer the user's question. If the context is not relevant, answer based on your general knowledge.
Context:
---
${contextText || "No relevant context found in project documents."}
---
`
    // Construct messages for Anthropic API
    const messagesForApi: Anthropic.Messages.MessageParam[] = []
    if (history && Array.isArray(history)) {
      messagesForApi.push(
        ...history.map((h: { role: "user" | "assistant"; content: string }) => ({ role: h.role, content: h.content })),
      )
    }
    messagesForApi.push({ role: "user", content: message })

    // Determine model to use
    let effectiveModel = requestedModel
    if (!effectiveModel) {
      const { data: threadData } = await supabase.from("chat_threads").select("model").eq("id", chatThreadId).single()
      effectiveModel = threadData?.model
    }
    if (!effectiveModel) {
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("preferred_model")
        .eq("user_id", user.id)
        .single()
      effectiveModel = userSettings?.preferred_model || "claude-3-5-sonnet-20241022"
    }

    // 2. Call Anthropic API
    const stream = await anthropic.messages.create({
      model: effectiveModel,
      messages: messagesForApi,
      system: systemPrompt,
      stream: true,
      max_tokens: 4000,
    })

    // 3. Save user message
    const { error: userMessageError } = await supabase.from("messages").insert({
      chat_thread_id: chatThreadId,
      role: "user",
      content: message,
      // tokens_used: calculate tokens for user message
    })
    if (userMessageError) console.error("Failed to save user message:", userMessageError)

    // 4. Stream response and save assistant message once complete
    const customStream = new ReadableStream({
      async start(controller) {
        let fullAssistantResponse = ""
        const textEncoder = new TextEncoder()

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text
            fullAssistantResponse += text
            controller.enqueue(textEncoder.encode(text))
          } else if (event.type === "message_delta") {
            // Handle other parts of delta if needed, e.g. usage
          } else if (event.type === "message_stop") {
            // Message fully received
            const { error: assistantMessageError } = await supabase.from("messages").insert({
              chat_thread_id: chatThreadId,
              role: "assistant",
              content: fullAssistantResponse,
              // tokens_used: calculate tokens for assistant message + context
            })
            if (assistantMessageError) console.error("Failed to save assistant message:", assistantMessageError)

            // Update chat_thread's updated_at timestamp
            const { error: updateThreadError } = await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", chatThreadId)

            if (updateThreadError) console.error("Failed to update chat_thread timestamp:", updateThreadError)

            controller.close()
            return
          }
        }
      },
      cancel() {
        console.log("Stream cancelled by client.")
      },
    })

    return new StreamingTextResponse(customStream)
  } catch (error) {
    console.error("[API CHAT ERROR]", error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Anthropic API Error: ${error.message}` }, { status: error.status || 500 })
    }
    return NextResponse.json({ error: (error as Error).message || "An unexpected error occurred" }, { status: 500 })
  }
}
