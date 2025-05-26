import axios, { AxiosResponse } from 'axios';

// API Configuration - Using the RunPod backend URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ag61pyffws3ral-8000.proxy.runpod.net';

// Axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout for long operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interfaces matching backend Pydantic models
export interface ManualGenerationRequest {
  query: string;
  image_path?: string;
  image_prompt?: string;
  k_images?: number;
}

export interface ManualGenerationResponse {
  generated_text: string;
  relevant_images_used: Array<{
    image_path?: string;
    prompt?: string;
    respuesta?: string;
    [key: string]: any;
  }>;
  query: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  query: string;
  conversation_id?: string;
  k?: number;
  temperature?: number;
}

export interface ChatResponse {
  completion: string;
  conversation_id?: string;
  sources?: Array<{
    score: number;
    metadata?: {
      filename?: string;
      page?: number;
      [key: string]: any;
    };
    content?: string;
  }>;
}

export interface DocumentInfo {
  filename: string;
  size: number;
  upload_date: string;
  pages?: number;
  status: 'processing' | 'completed' | 'error';
}

export interface RetrieveRequest {
  query: string;
  k?: number;
}

export interface RetrieveResponse {
  chunks?: Array<{
    content: string;
    metadata: {
      filename: string;
      page?: number;
      [key: string]: any;
    };
    score: number;
  }>;
  documents?: Array<DocumentInfo>;
}

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Manual Generation API
export const generateManual = async (request: ManualGenerationRequest): Promise<ManualGenerationResponse> => {
  try {
    const response: AxiosResponse<ManualGenerationResponse> = await api.post('/manuals/generate_manual', request);
    return response.data;
  } catch (error) {
    throw new Error(`Error generating manual: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Chat API
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const response: AxiosResponse<ChatResponse> = await api.post('/agent', request);
    return response.data;
  } catch (error) {
    throw new Error(`Error sending chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Document Upload API
export const uploadDocument = async (file: File): Promise<{ message: string; filename: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response: AxiosResponse<{ message: string; filename: string }> = await api.post('/ingest/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error uploading document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get Documents API
export const getDocuments = async (): Promise<DocumentInfo[]> => {
  try {
    const response: AxiosResponse<DocumentInfo[]> = await api.get('/documents');
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Retrieve Chunks API
export const retrieveChunks = async (request: RetrieveRequest): Promise<RetrieveResponse> => {
  try {
    const response: AxiosResponse<RetrieveResponse> = await api.post('/retrieve/chunks', request);
    return response.data;
  } catch (error) {
    throw new Error(`Error retrieving chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Retrieve Documents API
export const retrieveDocuments = async (request: RetrieveRequest): Promise<RetrieveResponse> => {
  try {
    const response: AxiosResponse<RetrieveResponse> = await api.post('/retrieve/docs', request);
    return response.data;
  } catch (error) {
    throw new Error(`Error retrieving documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default api;
