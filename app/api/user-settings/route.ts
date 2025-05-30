import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { encryptApiKey } from "@/lib/encryption" // Server-side encryption

export const runtime = "edge"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_settings")
      .select("anthropic_api_key, preferred_model") // Select only what's needed
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no row found, which is fine if user hasn't set settings yet
      console.error("Error fetching user settings:", error)
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
    }

    return NextResponse.json({
      isApiKeySet: !!data?.anthropic_api_key, // Send boolean instead of encrypted key
      preferredModel: data?.preferred_model || "claude-3-5-sonnet-20241022",
    })
  } catch (error) {
    console.error("API Error fetching user settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { apiKey, preferredModel } = await request.json()

    let encryptedApiKeyToStore: string | null = null
    if (apiKey && typeof apiKey === "string" && apiKey.trim() !== "") {
      encryptedApiKeyToStore = await encryptApiKey(apiKey.trim())
    } else {
      // If apiKey is empty or null, we might want to clear it.
      // Fetch existing settings to see if a key was set, to avoid unnecessary null writes if it was already null.
      const { data: existingSettings } = await supabase
        .from("user_settings")
        .select("anthropic_api_key")
        .eq("user_id", user.id)
        .single()
      if (!apiKey && existingSettings?.anthropic_api_key) {
        // User explicitly cleared the key
        encryptedApiKeyToStore = null
      } else if (existingSettings?.anthropic_api_key && !apiKey) {
        // User didn't provide a new key, keep the old one
        encryptedApiKeyToStore = existingSettings.anthropic_api_key
      }
    }

    const settingsData: {
      user_id: string
      anthropic_api_key?: string | null
      preferred_model: string
      updated_at: string
    } = {
      user_id: user.id,
      preferred_model: preferredModel || "claude-3-5-sonnet-20241022",
      updated_at: new Date().toISOString(),
    }

    // Only include anthropic_api_key in the upsert if it's being set or cleared
    // If apiKey was not provided in payload and one exists, we don't want to overwrite with undefined
    if (apiKey && apiKey.trim() !== "") {
      settingsData.anthropic_api_key = encryptedApiKeyToStore
    } else if (apiKey === null || apiKey === "") {
      // Explicitly clearing
      settingsData.anthropic_api_key = null
    }

    const { error: upsertError } = await supabase.from("user_settings").upsert(settingsData, { onConflict: "user_id" })

    if (upsertError) {
      console.error("Error saving user settings:", upsertError)
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json({ message: "Settings saved successfully" })
  } catch (error) {
    console.error("API Error saving user settings:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
