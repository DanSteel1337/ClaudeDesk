"use client"

import { useState, useEffect } from "react"
import type { ChatThread } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, MessageSquareText, Trash2, ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation" // For navigation

interface ProjectChatThreadsClientProps {
  initialChatThreads: ChatThread[]
  projectId: string
}

export default function ProjectChatThreadsClient({ initialChatThreads, projectId }: ProjectChatThreadsClientProps) {
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(initialChatThreads)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const router = useRouter()

  const fetchChatThreads = async () => {
    setIsLoadingList(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/chat_threads`)
      if (!response.ok) throw new Error("Failed to fetch chat threads")
      const data = await response.json()
      setChatThreads(data as ChatThread[])
    } catch (error) {
      toast.error((error as Error).message || "Could not load chat threads.")
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    // fetchChatThreads(); // Consider if needed on initial mount or rely on SSR data
  }, [projectId])

  const handleCreateNewThread = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat_threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }), // Default title
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create chat thread")
      }
      const newThread = (await response.json()) as ChatThread
      setChatThreads((prev) => [newThread, ...prev])
      toast.success("New chat thread created.")
      // Navigate to the new chat thread page
      router.push(`/dashboard/projects/${projectId}/chat/${newThread.id}`)
    } catch (error) {
      toast.error((error as Error).message || "Could not create chat thread.")
    }
  }

  const handleDeleteThread = async (threadId: string, threadTitle: string | null) => {
    if (
      !confirm(`Are you sure you want to delete chat thread "${threadTitle || "Untitled"}"? All messages will be lost.`)
    ) {
      return
    }
    try {
      const response = await fetch(`/api/projects/${projectId}/chat_threads/${threadId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete chat thread")
      }
      setChatThreads((prev) => prev.filter((thread) => thread.id !== threadId))
      toast.success(`Chat thread "${threadTitle || "Untitled"}" deleted.`)
    } catch (error) {
      toast.error((error as Error).message || "Could not delete chat thread.")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Chat Threads</CardTitle>
          <CardDescription>Start new conversations or continue existing ones within this project.</CardDescription>
        </div>
        <Button onClick={handleCreateNewThread}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Chat
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-2">
          <Button onClick={fetchChatThreads} variant="outline" size="sm" disabled={isLoadingList}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingList ? "animate-spin" : ""}`} /> Refresh List
          </Button>
        </div>
        {chatThreads.length === 0 && !isLoadingList && (
          <p className="text-center text-muted-foreground py-4">No chat threads yet. Start a new one!</p>
        )}
        {isLoadingList && chatThreads.length === 0 && (
          <p className="text-center text-muted-foreground py-4">Loading chat threads...</p>
        )}

        {chatThreads.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Model</TableHead>
                  <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatThreads.map((thread) => (
                  <TableRow key={thread.id}>
                    <TableCell className="font-medium flex items-center">
                      <MessageSquareText className="h-4 w-4 mr-2 text-muted-foreground" />
                      {thread.title || "Untitled Chat"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{thread.model}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(thread.updated_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteThread(thread.id, thread.title)}
                        title="Delete chat thread"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/projects/${projectId}/chat/${thread.id}`}>
                          Open <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
