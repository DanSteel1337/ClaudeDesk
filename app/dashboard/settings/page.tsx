"use client"

import { useState, useEffect, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client" // Use client-side Supabase
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [preferredModel, setPreferredModel] = useState("claude-3-5-sonnet-20241022")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isApiKeySet, setIsApiKeySet] = useState(false) // To know if a key is already configured
  const supabase = createClient()

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/user-settings")
        if (!response.ok) {
          throw new Error("Failed to load settings")
        }
        const data = await response.json()
        setIsApiKeySet(data.isApiKeySet)
        setPreferredModel(data.preferredModel)
      } catch (error) {
        toast.error((error as Error).message)
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, []) // Removed supabase from dependency array as it's stable

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Auth check can remain client-side for quick feedback,
      // but server API also validates auth.
      const supabaseAuth = createClient()
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser()
      if (!user) {
        toast.error("You must be logged in to save settings.")
        setIsSubmitting(false)
        return
      }

      const payload = {
        apiKey: apiKeyInput.trim() || null, // Send plaintext or null
        preferredModel: preferredModel,
      }

      const response = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }

      toast.success("Settings saved successfully!")
      if (apiKeyInput.trim()) setIsApiKeySet(true)
      else if (apiKeyInput.trim() === "" && isApiKeySet) {
        // If user cleared the input and a key was previously set
        // For now, we assume if they save an empty string, they intend to clear it.
        // The API logic handles this. We can update isApiKeySet based on successful save.
        setIsApiKeySet(false) // Or refetch settings to be absolutely sure
      }
      setApiKeyInput("") // Clear input after successful save
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error((error as Error).message || "Could not save settings.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
          <CardDescription>Manage your Anthropic API key and preferred model.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="apiKey">Anthropic API Key</Label>
              <Input
                id="apiKey"
                type="password" // Always password for input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={isApiKeySet ? "Enter new key to change" : "sk-ant-..."}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isApiKeySet
                  ? "An API key is configured. Enter a new key to update it."
                  : "Your API key is stored encrypted."}
              </p>
            </div>

            <div>
              <Label htmlFor="preferredModel">Preferred Claude Model</Label>
              <select
                id="preferredModel"
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-input dark:border-gray-600"
              >
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                {/* Add other models as they become available */}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This model will be used by default for new chat threads.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
