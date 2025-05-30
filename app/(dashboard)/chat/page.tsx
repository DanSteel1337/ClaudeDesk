"use client"

import { useState, useEffect, useCallback } from "react"
import { ChatInterface } from "@/components/chat/chat-interface"
import { ConversationList } from "@/components/chat/conversation-list"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [conversationListRefreshTrigger, setConversationListRefreshTrigger] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getUser()
  }, [supabase])

  const handleSelectConversation = useCallback((conversationId: string | null) => {
    setSelectedConversationId(conversationId)
  }, [])

  const triggerConversationListRefresh = useCallback(() => {
    setConversationListRefreshTrigger((prev) => prev + 1)
  }, [])

  const handleConversationDeleted = useCallback(
    (deletedConversationId: string) => {
      if (selectedConversationId === deletedConversationId) {
        setSelectedConversationId(null) // Clear selection if active chat is deleted
      }
      triggerConversationListRefresh() // Refresh list after deletion
    },
    [selectedConversationId, triggerConversationListRefresh],
  )

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div className="w-1/4 min-w-[250px]">
        {" "}
        {/* Added min-w */}
        {currentUser && (
          <ConversationList
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            refreshTrigger={conversationListRefreshTrigger}
            onConversationDeleted={handleConversationDeleted}
          />
        )}
      </div>
      <div className="w-3/4 flex-grow">
        {" "}
        {/* Added flex-grow */}
        {currentUser && ( // Ensure ChatInterface also only renders if user exists
          <ChatInterface
            key={selectedConversationId || "new-chat"} // Ensure re-mount for new chat
            conversationId={selectedConversationId}
            onNewConversationCreated={(newId) => {
              setSelectedConversationId(newId) // Select the new conversation
              triggerConversationListRefresh() // Refresh list
            }}
            userId={currentUser.id}
          />
        )}
      </div>
    </div>
  )
}
