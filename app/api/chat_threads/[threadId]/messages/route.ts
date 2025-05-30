// New API route to fetch messages for a specific chat thread
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: { threadId: string } }) {
  const threadId = params.threadId
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!threadId) {
      return NextResponse.json({ error: "Chat Thread ID is required" }, { status: 400 })
    }

    // Verify user has access to this chat thread (indirectly via project ownership or direct RLS on chat_threads)
    // For simplicity, RLS on 'messages' table should enforce that user can only access messages
    // in chat_threads they own.
    const { data: threadCheck } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", user.id)
      .single()

    if (!threadCheck) {
      return NextResponse.json({ error: "Chat thread not found or access denied" }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_thread_id", threadId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching messages:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }
    return NextResponse.json(messages)
  } catch (error) {
    console.error("API Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
