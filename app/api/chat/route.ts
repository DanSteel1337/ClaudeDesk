import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { decryptApiKey } from "@/lib/encryption"
import type { Message as ChatMessageDB } from "@/types/database"
import { TransformStream, TextEncoder, TextDecoder } from "stream"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = "edge"

async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error("Error generating query embedding:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message, messages: previousMessages = [], conversationId } = await request.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required and must be a string" }, { status: 400 })
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("anthropic_api_key, preferred_model")
      .eq("user_id", user.id)
      .single()

    if (!settings?.anthropic_api_key) {
      return NextResponse.json({ error: "Please configure your Anthropic API key in settings" }, { status: 400 })
    }

    const apiKey = await decryptApiKey(settings.anthropic_api_key)
    const anthropic = new Anthropic({ apiKey })

    let currentConversationId = conversationId as string | undefined
    let currentModel = settings.preferred_model || "claude-3-5-sonnet-20241022"
    let isNewConversation = false

    if (!currentConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: message.substring(0, 50),
          model: currentModel,
          // updated_at will be set by default/trigger
        })
        .select("id, model") // Select model as well
        .single()

      if (convError || !newConversation) {
        console.error("Error creating new conversation:", convError)
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
      }
      currentConversationId = newConversation.id
      currentModel = newConversation.model // Use model from new conversation
      isNewConversation = true
    } else {
      // Fetch the model for the existing conversation and update its timestamp
      const { data: existingConv, error: updateConvError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentConversationId)
        .eq("user_id", user.id)
        .select("model")
        .single()

      if (updateConvError) {
        console.error("Error updating conversation timestamp:", updateConvError)
        // Proceed even if timestamp update fails, but log it
      }
      if (existingConv?.model) {
        currentModel = existingConv.model
      }
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: currentConversationId,
      role: "user",
      content: message,
    })
    if (userMessageError) console.error("Error saving user message:", userMessageError)

    const queryEmbedding = await generateQueryEmbedding(message)
    let contextText = ""

    if (queryEmbedding) {
      const { data: chunks, error: searchError } = await supabase.rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3, // Reduced for brevity, tune as needed
        filter_user_id: user.id,
      })

      if (searchError) {
        console.error("Error searching document chunks:", searchError)
      } else if (chunks && chunks.length > 0) {
        contextText =
          "Relevant information from your documents:\n" +
          chunks
            .map((chunk: any) => `--- Chunk from ${chunk.context || "a document"} ---\n${chunk.content}`)
            .join("\n\n")
      }
    }

    const systemPrompt = `You are Claude, an AI assistant. You are helpful, harmless, and honest.
${
  contextText
    ? `Use the following information from the user's documents to answer their question:\n${contextText}\nIf the answer is not in the provided documents, clearly state that. Do not make up information not present in the documents.`
    : "You can answer general questions. If the user asks about their documents and no relevant information was found, inform them."
}
Always cite the source document if you use information from it, like "(Source: Document Name from context)".
Keep your answers concise and directly related to the user's question.`

    const anthropicMessages: Anthropic.Messages.MessageParam[] = []
    const recentPreviousMessages = previousMessages.slice(-6) as ChatMessageDB[]
    recentPreviousMessages.forEach((msg: ChatMessageDB) => {
      anthropicMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })
    })
    anthropicMessages.push({ role: "user", content: message })

    const stream = await anthropic.messages.create({
      model: currentModel,
      max_tokens: 4000,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    })

    let assistantResponseContent = ""
    const encoder = new TextEncoder()

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const decodedChunk = new TextDecoder().decode(chunk)
        const lines = decodedChunk.split("\n") // SSEs are newline-separated
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonString = line.substring(6).trim()
            if (jsonString === "[DONE]") {
              // Handle Vercel AI SDK [DONE] signal if present
              continue
            }
            try {
              const json = JSON.parse(jsonString)
              // Check for Anthropic's specific delta structure
              if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                assistantResponseContent += json.delta.text
                const clientData = JSON.stringify({
                  content: json.delta.text,
                  conversationId: currentConversationId, // Send currentConversationId
                  isNewConversation: isNewConversation, // And isNewConversation flag
                })
                controller.enqueue(encoder.encode(`data: ${clientData}\n\n`))
              } else if (json.type === "message_stop") {
                // Anthropic specific message stop
              }
            } catch (e) {
              // console.warn("Failed to parse JSON from stream:", jsonString, e);
              // If it's not JSON we care about, or malformed, we might ignore or pass through
            }
          }
        }
      },
      async flush(controller) {
        if (assistantResponseContent && currentConversationId) {
          const { error: assistantMessageError } = await supabase.from("messages").insert({
            conversation_id: currentConversationId,
            role: "assistant",
            content: assistantResponseContent,
          })
          if (assistantMessageError) console.error("Error saving assistant message:", assistantMessageError)
          else {
            // Also update conversation's updated_at upon successful assistant message save
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", currentConversationId)
              .eq("user_id", user.id)
          }
        }
        // Ensure a final [DONE] signal for the client if not already sent by Anthropic stream
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "[DONE]" })}\n\n`))
      },
    })

    const finalStream = stream.readable.pipeThrough(transformStream)

    return new Response(finalStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error", details: (error as Error).message }, { status: 500 })
  }
}
