import apiClient from '../utils/apiClient';

// Create a wrapped version of apiClient for document operations
const documentApi = {
  // Document listing and management
  listDocuments: (filters?: Record<string, any>) => 
    apiClient.post<any>('/documents', filters),
  
  getDocument: (documentId: string) => 
    apiClient.get<any>(`/documents/${documentId}`),
  
  deleteDocument: (documentId: string) => 
    apiClient.delete<any>(`/documents/${documentId}`),
  
  getDocumentStatus: (documentId: string) => 
    apiClient.get<any>(`/documents/${documentId}/status`),
  
  getDocumentByFilename: (filename: string) => 
    apiClient.get<any>(`/documents/filename/${filename}`),
  
  updateDocumentText: (documentId: string, text: string, metadata?: Record<string, any>) => 
    apiClient.post<any>(`/documents/${documentId}/update_text`, { text, metadata }),
  
  updateDocumentFile: (documentId: string, file: File, metadata?: Record<string, any>) => 
    apiClient.uploadFile<any>(`/documents/${documentId}/update_file`, file, metadata),
  
  updateDocumentMetadata: (documentId: string, metadata: Record<string, any>) => 
    apiClient.post<any>(`/documents/${documentId}/update_metadata`, { metadata }),
  
  // Ingestion endpoints
  ingestText: (text: string, metadata?: Record<string, any>) => 
    apiClient.post<any>('/ingest/text', { text, metadata }),
  
  ingestFile: (file: File, metadata?: Record<string, any>, onProgress?: (progressEvent: any) => void) => 
    apiClient.uploadFile<any>('/ingest/file', file, metadata, onProgress),
  
  ingestFiles: (files: File[], metadata?: Record<string, any>[], onProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file);
      if (metadata && metadata[index]) {
        formData.append(`metadata_${index}`, JSON.stringify(metadata[index]));
      }
    });
    
    return apiClient.post<any>('/ingest/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
  }
};

export default documentApi;
