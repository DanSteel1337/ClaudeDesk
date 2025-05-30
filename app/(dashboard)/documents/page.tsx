import { UploadForm } from "@/components/documents/upload-form"
import { DocumentList } from "@/components/documents/document-list"

export default function DocumentsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="text-gray-600 mt-2">Upload and manage your documents for Claude to reference</p>
      </div>

      <UploadForm />
      <DocumentList />
    </div>
  )
}
