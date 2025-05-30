// This is the Supabase ADMIN client, for use with the service_role key.
// Use this client for operations requiring elevated privileges, like bypassing RLS
// for background processing or administrative tasks.
// BE VERY CAREFUL WHERE YOU USE THIS. It should ONLY be used in server-side code
// where security is tightly controlled (e.g., trusted API routes, server actions).

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Declare a global variable to hold the client instance to avoid re-creating it.
let supabaseAdminSingleton: SupabaseClient<Database> | null = null

function createAdminClientInstance(): SupabaseClient<Database> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL or Service Role Key is not defined for admin client.")
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (supabaseAdminSingleton) {
    return supabaseAdminSingleton
  }
  supabaseAdminSingleton = createAdminClientInstance()
  return supabaseAdminSingleton
}

// Exporting with the specific name expected by the import in process-document route
export const createSupabaseAdminClient = getSupabaseAdminClient
