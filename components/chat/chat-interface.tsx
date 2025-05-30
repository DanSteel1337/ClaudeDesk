"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, Bot, User, Loader2, RefreshCw, AlertTriangle } from "lucide-react"
import type { Message as ChatMessageDB } from "@/types/database"

interface DisplayMessage {
  id: string // Can be temp (client-generated) or permanent (DB-generated)
  role: "user" | "assistant" | "error" // Added error role
  content: string
  timestamp: Date
  isOptimistic?: boolean // Flag for user messages not yet saved
}

interface ChatInterfaceProps {
  conversationId: string | null
  onNewConversationCreated: (newConversationId: string) => void
  userId: string
}

export function ChatInterface({ conversationId, onNewConversationCreated, userId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false) // Renamed from loading
  const [currentLocalConversationId, setCurrentLocalConversationId] = useState<string | null>(conversationId)
  const [error, setError] = useState<string | null>(null)
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback((behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const fetchMessageHistory = useCallback(
    async (convId: string) => {
      if (!convId || !userId) {
        setMessages([])
        return
      }
      setIsFetchingHistory(true)
      setError(null)
      try {
        const { data, error: dbError } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true })

        if (dbError) throw dbError

        const loadedMessages: DisplayMessage[] = (data || []).map((msg: ChatMessageDB) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }))
        setMessages(loadedMessages)
      } catch (err) {
        console.error("Error fetching message history:", err)
        setError("Failed to load message history. Please try refreshing.")
        setMessages([])
      } finally {
        setIsFetchingHistory(false)
        setTimeout(() => scrollToBottom("auto"), 0)
      }
    },
    [supabase, userId, scrollToBottom],
  )

  useEffect(() => {
    setCurrentLocalConversationId(conversationId) // Sync with prop
    if (conversationId) {
      fetchMessageHistory(conversationId)
    } else {
      setMessages([])
      setError(null)
    }
  }, [conversationId, fetchMessageHistory])

  useEffect(() => {
    if (!isFetchingHistory) {
      scrollToBottom()
    }
  }, [messages, isFetchingHistory, scrollToBottom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

    setError(null)
    const userMessageContent = input.trim()
    const tempUserMessageId = `optimistic-user-${Date.now()}`
    const userMessage: DisplayMessage = {
      id: tempUserMessageId,
      role: "user",
      content: userMessageContent,
      timestamp: new Date(),
      isOptimistic: true,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    // Prepare previous messages for API context, excluding optimistic ones
    const apiPreviousMessages = messages
      .filter((m) => !m.isOptimistic)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageContent,
          messages: apiPreviousMessages,
          conversationId: currentLocalConversationId,
        }),
      })

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `API Error: ${response.statusText} (${response.status})`)
      }

      // Remove optimistic user message, actual one will be saved by API and re-fetched or handled by stream
      setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessageId))

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const tempAssistantMessageId = `optimistic-assistant-${Date.now()}`
      let firstChunkProcessed = false
      let newConvIdFromStream: string | null = null
      let accumulatedContent = ""

      setMessages((prev) => [
        ...prev,
        { id: tempAssistantMessageId, role: "assistant", content: "", timestamp: new Date(), isOptimistic: true },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n\n") // SSE delimiter

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataString = line.substring(6).trim()
            if (dataString === "[DONE]" || JSON.parse(dataString)?.event === "[DONE]") {
              // Handle explicit [DONE] signal if sent by API
              break // Break inner loop
            }

            try {
              const parsed = JSON.parse(dataString)
              if (parsed.content) {
                accumulatedContent += parsed.content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempAssistantMessageId ? { ...msg, content: accumulatedContent } : msg,
                  ),
                )
              }
              if (parsed.conversationId && !firstChunkProcessed) {
                newConvIdFromStream = parsed.conversationId
                if (parsed.isNewConversation || !currentLocalConversationId) {
                  setCurrentLocalConversationId(parsed.conversationId)
                  onNewConversationCreated(parsed.conversationId)
                }
                firstChunkProcessed = true
              }
            } catch (e) {
              // console.warn("Error parsing stream chunk:", e, "Chunk:", dataString)
            }
          }
        }
      }
      // After stream is done, replace optimistic assistant message with final content (or refetch)
      // The API now saves the message, so a refetch ensures data integrity.
      if (newConvIdFromStream || currentLocalConversationId) {
        await fetchMessageHistory(newConvIdFromStream || currentLocalConversationId!)
      }
    } catch (err) {
      console.error("Chat submission error:", err)
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during chat."
      setError(errorMessage)
      // Remove optimistic messages if they were added
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== tempUserMessageId && msg.id !== `optimistic-assistant-${Date.now()}`),
      ) // This temp ID won't match, better to rely on refetch or more stable temp ID
      // Add a generic error message to the chat UI
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "error",
          content: `Error: ${errorMessage}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg">
          {isFetchingHistory ? "Loading Chat..." : currentLocalConversationId ? "Conversation" : "New Chat"}
        </CardTitle>
        {currentLocalConversationId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchMessageHistory(currentLocalConversationId)}
            disabled={isFetchingHistory || isSending}
            title="Refresh chat messages"
          >
            <RefreshCw className={`h-4 w-4 ${isFetchingHistory ? "animate-spin" : ""}`} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {isFetchingHistory && (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          )}
          {!isFetchingHistory && messages.length === 0 && !isSending && (
            <div className="text-center text-gray-500 mt-8">
              <Bot className="mx-auto h-12 w-12 mb-4" />
              <p>
                {currentLocalConversationId
                  ? "No messages in this conversation yet."
                  : "Start a new conversation with Claude."}
              </p>
            </div>
          )}
          {!isFetchingHistory &&
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : message.role === "assistant"
                        ? "bg-gray-100 text-gray-900"
                        : "bg-red-100 text-red-700" // Error message style
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.role === "assistant" && <Bot className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-600" />}
                    {message.role === "user" && <User className="h-5 w-5 mt-0.5 flex-shrink-0 text-white" />}
                    {message.role === "error" && (
                      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {isSending &&
            messages.length > 0 &&
            messages[messages.length - 1]?.isOptimistic &&
            messages[messages.length - 1]?.role === "user" && (
              // Show loader if the last message is an optimistic user message
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-gray-600" />
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  </div>
                </div>
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>

        {error &&
          !isFetchingHistory && ( // Show general error if not fetching history
            <div className="p-4 border-t">
              <p className="text-red-600 text-sm flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" /> {error}
              </p>
            </div>
          )}

        <form onSubmit={handleSubmit} className="flex space-x-2 p-4 border-t bg-white">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Claude..."
            disabled={isSending || isFetchingHistory}
            className="flex-1"
            aria-label="Chat input"
          />
          <Button type="submit" disabled={isSending || isFetchingHistory || !input.trim()} aria-label="Send message">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
