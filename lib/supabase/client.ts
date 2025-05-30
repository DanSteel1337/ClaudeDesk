// This is the BROWSER client for Supabase

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database" // Ensure this path is correct

// Declare a global variable to hold the client instance to avoid re-creating it on every call.
let supabaseBrowserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  // If the client already exists, return it.
  if (supabaseBrowserClient) {
    return supabaseBrowserClient
  }

  // Otherwise, create a new client and store it for future use.
  supabaseBrowserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return supabaseBrowserClient
}
