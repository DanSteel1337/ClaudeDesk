"use client"

import { Label } from "@/components/ui/label"

import { useState, useEffect, type ChangeEvent } from "react"
import type { Document } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"

interface ProjectDocumentsClientProps {
  initialDocuments: Document[]
  projectId: string
}

export default function ProjectDocumentsClient({ initialDocuments, projectId }: ProjectDocumentsClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isLoadingList, setIsLoadingList] = useState(false)

  const fetchDocuments = async () => {
    setIsLoadingList(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/documents`)
      if (!response.ok) throw new Error("Failed to fetch documents")
      const data = await response.json()
      setDocuments(data as Document[])
    } catch (error) {
      toast.error((error as Error).message || "Could not load documents.")
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    // Initial load is SSR, this effect is for subsequent client-side refreshes if needed
    // fetchDocuments(); // Potentially call if real-time updates are desired or after certain actions
  }, [projectId])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.")
      return
    }
    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append("file", selectedFile)
    // formData.append("projectId", projectId); // projectId is in the URL path for the API

    try {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `/api/projects/${projectId}/documents`, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percentComplete)
        }
      }

      xhr.onload = () => {
        setIsUploading(false)
        setSelectedFile(null)
        // Reset file input
        const fileInput = document.getElementById("file-upload") as HTMLInputElement
        if (fileInput) fileInput.value = ""

        if (xhr.status >= 200 && xhr.status < 300) {
          const newDocument = JSON.parse(xhr.responseText) as Document
          setDocuments((prev) => [{ ...newDocument, status: "pending" }, ...prev]) // Optimistically add with pending
          toast.success(`Document "${newDocument.name}" uploaded successfully. Initiating processing...`)
          // Optionally trigger processing immediately or rely on a backend worker
          triggerDocumentProcessing(newDocument.id, newDocument.name) // Pass name for toast
        } else {
          const errorData = JSON.parse(xhr.responseText)
          toast.error(errorData.error || `Upload failed with status: ${xhr.status}`)
        }
      }

      xhr.onerror = () => {
        setIsUploading(false)
        setSelectedFile(null)
        toast.error("Upload failed due to a network error.")
      }

      xhr.send(formData)
    } catch (error) {
      setIsUploading(false)
      setSelectedFile(null)
      toast.error((error as Error).message || "Upload failed.")
    }
  }

  async function triggerDocumentProcessing(documentId: string, documentName: string) {
    try {
      const response = await fetch(`/api/process-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, projectId }), // Pass projectId here
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to start processing")
      }
      toast.info(`Processing for "${documentName}" initiated.`)
      // Update local document status after triggering processing
      setDocuments((prevDocs) =>
        prevDocs.map((doc) => (doc.id === documentId ? { ...doc, status: "processing" } : doc)),
      )
      setTimeout(fetchDocuments, 7000) // Slightly longer delay for processing
    } catch (error) {
      toast.error(`Processing error: ${(error as Error).message}`)
    }
  }

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"? This will also delete its processed data.`)) {
      return
    }
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete document")
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
      toast.success(`Document "${documentName}" deleted.`)
    } catch (error) {
      toast.error((error as Error).message || "Could not delete document.")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Documents</CardTitle>
        <CardDescription>
          Manage the knowledge base for this project. Upload PDF, DOCX, TXT, or CSV files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border border-dashed rounded-lg">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Label htmlFor="file-upload" className="flex-grow">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 dark:text-slate-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-primary/10 file:text-primary
                       hover:file:bg-primary/20 dark:file:bg-primary/80 dark:file:text-primary-foreground dark:hover:file:bg-primary"
                accept=".pdf,.docx,.txt,.csv"
                disabled={isUploading}
              />
            </Label>
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full sm:w-auto">
              <UploadCloud className="mr-2 h-4 w-4" /> {isUploading ? `Uploading... ${uploadProgress}%` : "Upload File"}
            </Button>
          </div>
          {isUploading && <Progress value={uploadProgress} className="w-full mt-2 h-2" />}
          {selectedFile && !isUploading && (
            <p className="text-sm text-muted-foreground mt-2">Selected: {selectedFile.name}</p>
          )}
        </div>

        <div className="flex justify-end mb-2">
          <Button onClick={fetchDocuments} variant="outline" size="sm" disabled={isLoadingList}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingList ? "animate-spin" : ""}`} /> Refresh List
          </Button>
        </div>

        {documents.length === 0 && !isLoadingList && (
          <p className="text-center text-muted-foreground py-4">No documents uploaded yet.</p>
        )}
        {isLoadingList && documents.length === 0 && (
          <p className="text-center text-muted-foreground py-4">Loading documents...</p>
        )}

        {documents.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      {doc.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{doc.mime_type?.split("/")[1] || "N/A"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(2) + " MB" : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <span className="capitalize">{doc.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
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
