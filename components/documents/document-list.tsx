"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { File, Trash2, Download } from "lucide-react"
import type { Document } from "@/types/database"

export function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase.from("documents").delete().eq("id", id)

      if (error) throw error
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
    } catch (error) {
      console.error("Error deleting document:", error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Loading documents...</p>
        </CardContent>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">No documents uploaded yet</p>
          <p className="text-sm text-gray-500 mt-2">Upload your first document to get started</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-gray-400" />
                <div>
                  <h3 className="font-medium">{document.name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{(document.file_size! / 1024 / 1024).toFixed(1)} MB</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        document.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : document.status === "processing"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {document.status}
                    </span>
                    <span>{new Date(document.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {document.file_url && (
                  <Button variant="outline" size="sm" onClick={() => window.open(document.file_url!, "_blank")}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => deleteDocument(document.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
