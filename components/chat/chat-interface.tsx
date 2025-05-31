"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import type { Message as MessageType } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, User, Bot, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ChatInterfaceProps {
  initialMessages?: MessageType[]
  chatThreadId: string
  projectId: string
  currentModel: string
}

interface DisplayMessage extends MessageType {
  id: string
  isStreaming?: boolean
  error?: boolean
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
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages])

  // Fetch message history on component mount
  useEffect(() => {
    const fetchMessageHistory = async () => {
      if (!chatThreadId) {
        setIsFetchingHistory(false)
        return
      }

      setIsFetchingHistory(true)
      setConnectionError(null)

      try {
        const response = await fetch(`/api/chat_threads/${chatThreadId}/messages`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.statusText}`)
        }
        
        const history = (await response.json()) as MessageType[]
        setMessages(history.map((m) => ({ ...m, id: m.id.toString() })))
      } catch (error) {
        console.error("Error fetching message history:", error)
        setConnectionError(error instanceof Error ? error.message : "Failed to load chat history")
        toast.error("Failed to load chat history")
      } finally {
        setIsFetchingHistory(false)
      }
    }

    fetchMessageHistory()
  }, [chatThreadId])

  const retryConnection = () => {
    setConnectionError(null)
    window.location.reload()
  }

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setConnectionError(null)

    // Create user message
    const userDisplayMessage: DisplayMessage = {
      id: Date.now().toString(),
      chat_thread_id: chatThreadId,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
      tokens_used: 0,
    }

    setMessages((prev) => [...prev, userDisplayMessage])
    setIsLoading(true)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    // Add placeholder for assistant's message
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantPlaceholder: DisplayMessage = {
      id: assistantMessageId,
      chat_thread_id: chatThreadId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      tokens_used: 0,
      isStreaming: true,
    }

    setMessages((prev) => [...prev, assistantPlaceholder])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          chatThreadId: chatThreadId,
          projectId: projectId,
          model: currentModel,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        let errorMessage = "Unknown error occurred"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType?.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } else {
            errorMessage = await response.text() || errorMessage
          }
        } catch {
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
      let assistantResponseContent = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          assistantResponseContent += chunk

          // Update the assistant message with accumulated content
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    content: assistantResponseContent,
                    isStreaming: true
                  } 
                : msg
            )
          )
        }
      } finally {
        reader.releaseLock()
      }

      // Mark streaming as complete
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      )

      // Refetch messages to ensure consistency with database
      if (assistantResponseContent) {
        try {
          const historyResponse = await fetch(`/api/chat_threads/${chatThreadId}/messages`)
          if (historyResponse.ok) {
            const history = (await historyResponse.json()) as MessageType[]
            setMessages(history.map((m) => ({ ...m, id: m.id.toString() })))
          }
        } catch (refetchError) {
          console.error("Failed to refetch messages:", refetchError)
          // Don't show error to user for this background operation
        }
      }

    } catch (error) {
      console.error("Chat error:", error)
      
      const isAborted = error instanceof Error && error.name === 'AbortError'
      if (isAborted) {
        toast.info("Message cancelled")
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to get response"
        toast.error(errorMessage)
        setConnectionError(errorMessage)
      }

      // Replace streaming placeholder with error message or remove if aborted
      setMessages((prev) =>
        isAborted 
          ? prev.filter(msg => msg.id !== assistantMessageId)
          : prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    isStreaming: false,
                    error: true,
                  }
                : msg
            )
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // Show loading state while fetching history
  if (isFetchingHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading chat history...</p>
      </div>
    )
  }

  // Show connection error
  if (connectionError && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load chat: {connectionError}
          </AlertDescription>
        </Alert>
        <Button onClick={retryConnection} className="mt-4" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-grow p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Ask me anything about your documents in this project.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id || index}
                className={cn(
                  "flex items-start gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      <Bot size={18} />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.error
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-muted"
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {message.content + (message.isStreaming ? "▍" : "")}
                    </Markdown>
                  </div>
                  
                  {message.isStreaming && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      <User size={18} />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Connection error banner */}
      {connectionError && messages.length > 0 && (
        <div className="px-4 py-2 border-t">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Connection error: {connectionError}</span>
              <Button onClick={retryConnection} size="sm" variant="outline">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input form */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-grow"
            disabled={isLoading}
            maxLength={4000}
          />
          
          {isLoading ? (
            <Button 
              onClick={cancelRequest} 
              size="icon" 
              variant="outline"
              type="button"
              title="Cancel request"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={!input.trim()} 
              size="icon"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
        
        <p className="text-xs text-muted-foreground text-center mt-2 max-w-4xl mx-auto">
          Model: {currentModel} • {input.length}/4000 characters
        </p>
      </div>
    </div>
  )
}
