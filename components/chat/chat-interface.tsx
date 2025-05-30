// This is a simplified/refactored version of a potential ChatInterface
// It needs to be adapted to fetch messages for a specific threadId and use projectId for /api/chat
"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import type { Message as MessageType } from "@/types/database" // Assuming Message type is defined
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, User, Bot, Loader2 } from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

interface ChatInterfaceProps {
  initialMessages?: MessageType[] // Can be empty, fetched client-side
  chatThreadId: string
  projectId: string
  currentModel: string
}

interface DisplayMessage extends MessageType {
  // For optimistic updates or client-side additions
  id: string // Ensure ID is always string for keys
  isStreaming?: boolean
}

export default function ChatInterface({
  initialMessages = [],
  chatThreadId,
  projectId,
  currentModel,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({ ...m, id: m.id.toString() })),
  )
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingHistory, setIsFetchingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  useEffect(() => {
    const fetchMessageHistory = async () => {
      setIsFetchingHistory(true)
      try {
        const response = await fetch(`/api/chat_threads/${chatThreadId}/messages`)
        if (!response.ok) {
          throw new Error("Failed to fetch message history")
        }
        const history = (await response.json()) as MessageType[]
        setMessages(history.map((m) => ({ ...m, id: m.id.toString() })))
      } catch (error) {
        toast.error((error as Error).message)
      } finally {
        setIsFetchingHistory(false)
      }
    }
    if (chatThreadId) {
      fetchMessageHistory()
    } else {
      setIsFetchingHistory(false)
    }
  }, [chatThreadId])

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userInput: DisplayMessage = {
      id: Date.now().toString(), // Temporary ID for optimistic update
      chat_thread_id: chatThreadId,
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
      tokens_used: 0, // Placeholder
    }

    setMessages((prev) => [...prev, userInput])
    setInput("")
    setIsLoading(true)

    let assistantResponseContent = ""
    const assistantMessageId = (Date.now() + 1).toString() // Temporary ID for streaming

    // Add a placeholder for the assistant's message for streaming
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        chat_thread_id: chatThreadId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        tokens_used: 0,
        isStreaming: true,
      },
    ])

    try {
      const response = await fetch("/api/chat", {
        // This API needs to be updated for projectId
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput.content,
          chatThreadId: chatThreadId,
          projectId: projectId, // Send projectId
          model: currentModel,
          // Include conversation history if your API expects it
          // history: messages.slice(0, -2).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error occurred" }))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        const chunk = decoder.decode(value, { stream: true })
        assistantResponseContent += chunk

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: assistantResponseContent, isStreaming: !done } : msg,
          ),
        )
      }
      // After stream finishes, the last message update will have isStreaming: false
      // The actual message saving (user + assistant) should happen in the /api/chat endpoint
      // and it could return the persisted messages, or we refetch.
      // For simplicity, we assume the API saves and we might refetch or rely on optimistic updates.
    } catch (error) {
      console.error("Chat error:", error)
      toast.error((error as Error).message || "Failed to get response from assistant.")
      // Remove the streaming placeholder on error or replace with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${(error as Error).message}`, isStreaming: false }
            : msg,
        ),
      )
    } finally {
      setIsLoading(false)
      // Refetch messages to get actual IDs and created_at from DB
      // This ensures consistency after the stream.
      if (chatThreadId) {
        // Ensure chatThreadId is valid before refetching
        const response = await fetch(`/api/chat_threads/${chatThreadId}/messages`)
        if (response.ok) {
          const history = (await response.json()) as MessageType[]
          setMessages(history.map((m) => ({ ...m, id: m.id.toString() })))
        } else {
          console.error("Failed to refetch messages after send.")
          // Potentially notify user or handle gracefully
        }
      }
    }
  }

  if (isFetchingHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading chat history...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 bg-background">
      <ScrollArea className="flex-grow mb-4 pr-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id || index} // Use message.id if available, otherwise index
              className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : ""}`}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <Bot size={18} />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <Markdown remarkPlugins={[remarkGfm]}>{message.content + (message.isStreaming ? "▍" : "")}</Markdown>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User size={18} />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
