"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { encryptApiKey } from "@/lib/encryption"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const CLAUDE_MODELS = [
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Recommended)" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast & Affordable)" },
  { value: "claude-3-opus-20240229", label: "Claude 3 Opus (Most Capable)" },
]

export function SettingsForm() {
  const [apiKey, setApiKey] = useState("")
  const [preferredModel, setPreferredModel] = useState("claude-3-5-sonnet-20241022")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [hasExistingKey, setHasExistingKey] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from("user_settings").select("anthropic_api_key, preferred_model").single()

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching settings:", error)
        return
      }

      if (data) {
        setHasExistingKey(!!data.anthropic_api_key)
        setPreferredModel(data.preferred_model || "claude-3-5-sonnet-20241022")

        if (data.anthropic_api_key) {
          // Show masked API key
          setApiKey("sk-ant-" + "*".repeat(40))
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      let encryptedApiKey = null

      // Only encrypt if user provided a new API key
      if (apiKey && !apiKey.includes("*")) {
        if (!apiKey.startsWith("sk-ant-")) {
          throw new Error("Invalid Anthropic API key format")
        }
        encryptedApiKey = await encryptApiKey(apiKey)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const updateData: any = {
        user_id: user.id,
        preferred_model: preferredModel,
      }

      if (encryptedApiKey) {
        updateData.anthropic_api_key = encryptedApiKey
      }

      const { error } = await supabase.from("user_settings").upsert(updateData)

      if (error) throw error

      setMessage("Settings saved successfully!")
      if (encryptedApiKey) {
        setHasExistingKey(true)
        setApiKey("sk-ant-" + "*".repeat(40))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  const clearApiKey = () => {
    setApiKey("")
    setHasExistingKey(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <CardDescription>Configure your Anthropic API key to start chatting with Claude</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Anthropic API Key</Label>
            <div className="space-y-2">
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                disabled={loading}
              />
              {hasExistingKey && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">✓ API key configured</span>
                  <Button type="button" variant="outline" size="sm" onClick={clearApiKey}>
                    Update Key
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Get your API key from{" "}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Preferred Model</Label>
            <Select value={preferredModel} onValueChange={setPreferredModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAUDE_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">Choose the Claude model that best fits your needs</p>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>{message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
