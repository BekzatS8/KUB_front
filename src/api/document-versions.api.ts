import api from './index'

export interface DocumentVersion {
  id: number
  document_id: number
  version: number
  file_path?: string
  file_path_pdf?: string
  file_path_docx?: string
  file_size?: number
  mime_type?: string
  uploaded_by?: number
  comment?: string
  created_at: string
}

export async function getDocumentVersions(docId: number): Promise<DocumentVersion[]> {
  const res = await api.get(`/documents/${docId}/versions`)
  return res.data.versions || []
}

export async function uploadDocumentVersion(docId: number, file: File, comment?: string): Promise<DocumentVersion> {
  const formData = new FormData()
  formData.append('file', file)
  if (comment) {
    formData.append('comment', comment)
  }
  const res = await api.post(`/documents/${docId}/versions`, formData)
  return res.data
}

export async function downloadDocumentVersion(docId: number, versionId: number): Promise<Blob> {
  const res = await api.get(`/documents/${docId}/versions/${versionId}/file`, {
    responseType: 'blob',
  })
  return res.data
}

export async function restoreDocumentVersion(docId: number, versionId: number): Promise<{ message: string }> {
  const res = await api.post(`/documents/${docId}/versions/${versionId}/restore`)
  return res.data
}
