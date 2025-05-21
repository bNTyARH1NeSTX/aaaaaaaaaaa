import apiClient from '../utils/apiClient';

// Types
export interface Document {
  id: string;
  filename: string;
  text_content?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  documents: Document[];
}

export interface RetrieveChunksRequest {
  query: string;
  top_k?: number;
  filter_metadata?: Record<string, any>;
  rerank?: boolean;
  include_metadata?: boolean;
}

export interface ChunkResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
  document_id: string;
}

// API functions
export const listDocuments = async (filters?: Record<string, any>) => {
  const response = await apiClient.post<{items: Document[]}>('/documents', filters);
  return response.data.items;
};

export const getDocument = async (documentId: string) => {
  const response = await apiClient.get<Document>(`/documents/${documentId}`);
  return response.data;
};

export const deleteDocument = async (documentId: string) => {
  return apiClient.delete<void>(`/documents/${documentId}`);
};

export const ingestText = async (text: string, metadata?: Record<string, any>) => {
  const response = await apiClient.post<Document>('/ingest/text', { text, metadata });
  return response.data;
};

export const ingestFile = async (
  file: File, 
  metadata?: Record<string, any>,
  onProgress?: (progressEvent: any) => void
) => {
  const response = await apiClient.uploadFile<Document>('/ingest/file', file, metadata, onProgress);
  return response.data;
};

export const ingestFiles = async (
  files: File[], 
  metadata?: Record<string, any>[],
  onProgress?: (progressEvent: any) => void
) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append('files', file);
    if (metadata && metadata[index]) {
      formData.append(`metadata_${index}`, JSON.stringify(metadata[index]));
    }
  });
  
  const response = await apiClient.post<{documents: Document[]}>('/ingest/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
  return response.data.documents;
};

export const retrieveChunks = async (request: RetrieveChunksRequest) => {
  const response = await apiClient.post<{chunks: ChunkResult[]}>('/retrieve/chunks', request);
  return response.data.chunks;
};

export const retrieveDocuments = async (request: RetrieveChunksRequest) => {
  const response = await apiClient.post<{documents: Document[]}>('/retrieve/docs', request);
  return response.data.documents;
};

export const createFolder = async (name: string, description?: string) => {
  const response = await apiClient.post<Folder>('/folders', { name, description });
  return response.data;
};

export const listFolders = async () => {
  const response = await apiClient.get<Folder[]>('/folders');
  return response.data;
};

export const getFolder = async (folderId: string) => {
  const response = await apiClient.get<Folder>(`/folders/${folderId}`);
  return response.data;
};

export const deleteFolder = async (folderName: string) => {
  return apiClient.delete<void>(`/folders/${folderName}`);
};

export const addDocumentToFolder = async (folderId: string, documentId: string) => {
  return apiClient.post<void>(`/folders/${folderId}/documents/${documentId}`, {});
};

export const removeDocumentFromFolder = async (folderId: string, documentId: string) => {
  return apiClient.delete<void>(`/folders/${folderId}/documents/${documentId}`);
};

export const setFolderRule = async (folderId: string, rule: {
  field: string;
  operator: string;
  value: any;
}) => {
  return apiClient.post<void>(`/folders/${folderId}/set_rule`, rule);
};
