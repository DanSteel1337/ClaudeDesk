"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Conversation } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, PlusCircle, Loader2, Trash2, RefreshCw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" // Assuming you have this shadcn component

interface ConversationListProps {
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string | null) => void
  refreshTrigger: number // Added to trigger refresh from parent
  onConversationDeleted: (deletedConversationId: string) => void
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
  refreshTrigger,
  onConversationDeleted,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setConversations([])
      return
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Error fetching conversations:", error)
      setConversations([]) // Clear on error
    } else {
      setConversations(data || [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, refreshTrigger])

  const handleDeleteConversation = async (conversationId: string) => {
    setDeletingId(conversationId)
    try {
      // RLS should handle user_id check, or add .eq('user_id', user.id)
      // Ensure cascade delete is set up in DB for messages, or delete them manually first.
      // For now, assuming cascade delete on `messages.conversation_id` FOREIGN KEY.
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId)
      if (error) throw error

      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      onConversationDeleted(conversationId) // Notify parent
    } catch (error) {
      console.error("Error deleting conversation:", error)
      // TODO: Show toast notification for error
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg">Chats</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchConversations} disabled={loading} title="Refresh list">
            <RefreshCw className={`h-4 w-4 ${loading && !deletingId ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSelectConversation(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2 flex-grow overflow-y-auto">
        {loading && !deletingId ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-gray-500 p-4 text-center">No conversations yet. Start a new chat!</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((convo) => (
              <div key={convo.id} className="flex items-center group">
                <Button
                  variant={selectedConversationId === convo.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto py-2 pr-8" // Added pr-8 for delete button space
                  onClick={() => onSelectConversation(convo.id)}
                  disabled={deletingId === convo.id}
                >
                  <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                  <div className="flex-grow overflow-hidden">
                    <p className="text-sm font-medium truncate">{convo.title || "Untitled Conversation"}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(convo.updated_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={deletingId === convo.id}
                      title="Delete conversation"
                    >
                      {deletingId === convo.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the conversation titled &quot;
                        {convo.title || "Untitled Conversation"}&quot; and all its messages. This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteConversation(convo.id)}
                        className="bg-red-600 hover:bg-red-700" // Destructive variant
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
