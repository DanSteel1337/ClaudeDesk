"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import type { Message as MessageType } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, User, Bot, Loader2 } from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

interface ChatInterfaceProps {
  initialMessages?: MessageType[]
  chatThreadId: string
  projectId: string
  currentModel: string
}

interface DisplayMessage extends MessageType {
  id: string
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
        console.error("Error fetching message history:", error)
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
      id: Date.now().toString(),
      chat_thread_id: chatThreadId,
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
      tokens_used: 0,
    }

    setMessages((prev) => [...prev, userInput])
    setInput("")
    setIsLoading(true)

    let assistantResponseContent = ""
    const assistantMessageId = (Date.now() + 1).toString()

    // Add placeholder for assistant's message
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/plain, application/json",
        },
        body: JSON.stringify({
          message: userInput.content,
          chatThreadId: chatThreadId,
          projectId: projectId,
          model: currentModel,
        }),
      })

      // Check if response is JSON (error) or streaming text
      const contentType = response.headers.get("content-type")

      if (!response.ok) {
        let errorMessage = "Unknown error occurred"
        try {
          if (contentType?.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            errorMessage = (await response.text()) || errorMessage
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error("No response body received")
      }

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantResponseContent += chunk

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: assistantResponseContent, isStreaming: false } : msg,
          ),
        )
      }

      // Final update to remove streaming indicator
      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg)),
      )
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage = (error as Error).message || "Failed to get response from assistant."
      toast.error(errorMessage)

      // Replace streaming placeholder with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `❌ Error: ${errorMessage}`,
                isStreaming: false,
              }
            : msg,
        ),
      )
    } finally {
      setIsLoading(false)

      // Refetch messages to ensure consistency (only if no error occurred)
      if (chatThreadId && assistantResponseContent) {
        try {
          const response = await fetch(`/api/chat_threads/${chatThreadId}/messages`)
          if (response.ok) {
            const history = (await response.json()) as MessageType[]
            setMessages(history.map((m) => ({ ...m, id: m.id.toString() })))
          }
        } catch (refetchError) {
          console.error("Failed to refetch messages after send:", refetchError)
          // Don't show error to user for this background operation
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
              key={message.id || index}
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
