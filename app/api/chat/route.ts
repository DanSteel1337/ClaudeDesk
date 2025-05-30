import { type NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { OpenAI } from "openai"
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
    console.error("Error fetching API key from user_settings:", error)
    return null
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
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { message, chatThreadId, projectId, model: requestedModel, history } = body

    if (!message || !chatThreadId || !projectId) {
      return NextResponse.json({ error: "Missing message, chatThreadId, or projectId" }, { status: 400 })
    }

    // Verify user owns the chat thread and project
    const { data: threadData, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, project_id, model")
      .eq("id", chatThreadId)
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .single()

    if (threadError || !threadData) {
      console.error("Chat thread verification failed:", threadError)
      return NextResponse.json({ error: "Chat thread not found or access denied" }, { status: 404 })
    }

    const anthropicApiKey = await getAnthropicApiKey(user.id, supabase)
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured or is invalid. Please check your settings." },
        { status: 403 },
      )
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    // 1. RAG: Fetch relevant document chunks for the projectId
    let contextText = ""
    try {
      if (process.env.OPENAI_API_KEY) {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: message,
        })
        const queryEmbedding = embeddingResponse.data[0].embedding

        const supabaseAdmin = createSupabaseAdminClient()
        const { data: chunks, error: matchError } = await supabaseAdmin.rpc("match_document_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          filter_user_id: user.id,
          filter_project_id: projectId,
        })

        if (matchError) {
          console.error("Error matching document chunks:", matchError)
        } else if (chunks && chunks.length > 0) {
          contextText = chunks.map((chunk: any) => chunk.content).join("\n\n")
        }
      }
    } catch (ragError) {
      console.error("Error during RAG embedding/matching:", ragError)
      // Continue without context rather than failing
    }

    const systemPrompt = contextText
      ? `You are a helpful AI assistant. Use the following context from documents related to the current project to answer the user's question. If the context is not relevant, answer based on your general knowledge.

Context:
---
${contextText}
---

Please provide helpful and accurate responses based on the context above when relevant.`
      : "You are a helpful AI assistant. Please provide helpful and accurate responses to the user's questions."

    // Construct messages for Anthropic API
    const messagesForApi: Anthropic.Messages.MessageParam[] = []
    if (history && Array.isArray(history)) {
      messagesForApi.push(
        ...history.map((h: { role: "user" | "assistant"; content: string }) => ({ role: h.role, content: h.content })),
      )
    }
    messagesForApi.push({ role: "user", content: message })

    // Determine model to use
    const effectiveModel = requestedModel || threadData.model || "claude-3-5-sonnet-20241022"

    // Save user message first
    const { error: userMessageError } = await supabase.from("messages").insert({
      chat_thread_id: chatThreadId,
      role: "user",
      content: message,
    })
    if (userMessageError) {
      console.error("Failed to save user message:", userMessageError)
    }

    // Create Anthropic stream
    const anthropicStream = await anthropic.messages.create({
      model: effectiveModel,
      messages: messagesForApi,
      system: systemPrompt,
      stream: true,
      max_tokens: 4000,
    })

    // Create a custom readable stream
    const stream = new ReadableStream({
      async start(controller) {
        const textEncoder = new TextEncoder()
        let fullAssistantResponse = ""

        try {
          for await (const event of anthropicStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text
              fullAssistantResponse += text
              controller.enqueue(textEncoder.encode(text))
            } else if (event.type === "message_stop") {
              // Save assistant message
              const { error: assistantMessageError } = await supabase.from("messages").insert({
                chat_thread_id: chatThreadId,
                role: "assistant",
                content: fullAssistantResponse,
              })
              if (assistantMessageError) {
                console.error("Failed to save assistant message:", assistantMessageError)
              }

              // Update chat_thread timestamp
              await supabase
                .from("chat_threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", chatThreadId)
                .catch((updateError) => console.error("Failed to update thread timestamp:", updateError))

              controller.close()
              return
            }
          }
        } catch (streamError) {
          console.error("Streaming error:", streamError)
          const errorMessage = `Streaming error: ${(streamError as Error).message}`
          controller.enqueue(textEncoder.encode(errorMessage))
          controller.close()
        }
      },
      cancel() {
        console.log("Stream cancelled by client.")
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[API CHAT ERROR]", error)

    // Return a proper JSON error response
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Anthropic API Error: ${error.message}` }, { status: error.status || 500 })
    }

    return NextResponse.json({ error: (error as Error).message || "An unexpected error occurred" }, { status: 500 })
  }
}
